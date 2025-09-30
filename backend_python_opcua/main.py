import uvicorn
import asyncio
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from opcua import Client
from typing import Any, Dict, List, Optional
from db_opcua import init_db, get_connection , register_plc_and_nodes


# ---- Shared Models ----
class Status(BaseModel):
    plc_no: Optional[int] = None
    plc_status: str
    opcua_status: str

# ---- Client -> Server (Request Models) ----
class ClientSendOpcuaUrl(BaseModel):
    plc_no: int
    opcua_url: str

class ClientSendNodeNames(BaseModel):
    plc_no: int
    node_names: List[str]

class DeletePLCRequest(BaseModel):
    plc_no: int

# ---- Server -> Client (Response Models) ----
class ServerSendDataDict(BaseModel):
    data: Dict[str, Any]

class ConnectPLCResponse(BaseModel):
    status: str
    plc_no: int
    nodes_registered: int

class PLCStatusResponse(BaseModel):
    plc_id: str
    plc_no: int
    plc_ip: str
    opcua_url: str
    plc_status: str
    opcua_status: str
    is_connected: bool
    status: str
    last_checked: str
    message: str

# Removed AllPLCsStatusResponse as it's not needed - we can return List[PLCStatusResponse] directly

class DeletePLCResponse(BaseModel):
    status: str
    message: str
    plc_deleted: int
    nodes_deleted: int

class RootResponse(BaseModel):
    message: str


# ---- Global connection holder ----
db_conn = None  

# ---- Background monitoring function ----
async def monitor_plc_status():
    """
    Background task that monitors PLC and OPC UA status every 30 seconds
    """
    while True:
        try:
            await asyncio.sleep(30)  # Wait 30 seconds
            
            if not db_conn:
                continue
                
            # Query all PLCs with heartbeat nodes
            cur = db_conn.cursor()
            cur.execute("SELECT plc_no, opcua_url, opcua_reg_hb_node_id FROM plcs WHERE opcua_reg_hb_node_id != ''")
            plcs = cur.fetchall()
            
            current_time = datetime.now().isoformat()
            
            for plc_no, opcua_url, hb_node_id in plcs:
                if not hb_node_id:  # Skip if no heartbeat node
                    continue
                    
                try:
                    # Connect and read heartbeat value
                    client = Client(opcua_url)
                    client.connect()
                    
                    # OPC UA connection successful
                    opcua_status = "connected"
                    
                    # Read PLC status from heartbeat node
                    node = client.get_node(hb_node_id)
                    value = node.get_value()
                    plc_status = "connected" if value else "disconnected"
                    
                    client.disconnect()
                    
                    # Update both statuses in database
                    cur.execute(
                        "UPDATE plcs SET plc_status = ?, opcua_status = ?, last_heartbeat_check = ? WHERE plc_no = ?",
                        (plc_status, opcua_status, current_time, plc_no)
                    )
                    print(f"PLC {plc_no}: PLC={plc_status}, OPC UA={opcua_status} (heartbeat: {value})")
                    
                except Exception as e:
                    # Connection failed - mark both as disconnected
                    cur.execute(
                        "UPDATE plcs SET plc_status = ?, opcua_status = ?, last_heartbeat_check = ? WHERE plc_no = ?",
                        ("disconnected", "disconnected", current_time, plc_no)
                    )
                    print(f"PLC {plc_no}: Both disconnected (error: {e})")
            
            db_conn.commit()
            
        except Exception as e:
            print(f"Error in status monitor: {e}")

# ---- Lifespan context ----
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    # Startup
    init_db()
    db_conn = get_connection()
    print("✅ Database initialized and connected.")
    
    # Start background monitoring
    monitor_task = asyncio.create_task(monitor_plc_status())
    print("✅ Background PLC monitoring started.")
    
    yield
    
    # Shutdown
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        print("🛑 Background monitoring stopped.")
    
    if db_conn:
        db_conn.close()
        print("🛑 Database connection closed.")

# ---- App instance ----
app = FastAPI(lifespan=lifespan)
origins = [
           "http://localhost:5000",
           ]
app.add_middleware(CORSMiddleware, 
                   allow_origins=origins,
                   allow_credentials=True, 
                   allow_methods=["*"], 
                   allow_headers=["*"])

# ---- API Endpoints ----
@app.get("/", response_model=RootResponse)
async def root():
    return {"message": "FastAPI OPC UA backend is running 🚀"}

# 1: connect and register PLC + nodes ----
@app.post("/connect", response_model=ConnectPLCResponse)
async def connect_plc(payload: ClientSendOpcuaUrl):
    """
    Connects to the PLC's OPC UA server, browses all nodes, filters them
    according to naming convention, and stores both PLC info and nodes in DB.
    """
    result = register_plc_and_nodes(payload.plc_no, payload.opcua_url, db_conn)

    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))

    # Return the opcua_status as the main status (since browsing was successful)
    return {
        "status": result.get("opcua_status", "connected"),
        "plc_no": payload.plc_no,
        "nodes_registered": result.get("nodes_count", 0)
    }


# 2: Bulk status check for all PLCs ----
@app.get("/all-status", response_model=List[PLCStatusResponse])
async def get_all_plcs_status():
    """
    Returns status for all PLCs in the database with separate PLC and OPC UA statuses.
    This endpoint is called by the frontend every 30 seconds for real-time updates.
    """
    try:
        if db_conn is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
            
        cur = db_conn.cursor()
        
        # Get all PLCs from database with separate statuses
        cur.execute("""
            SELECT plc_no, opcua_url, plc_status, opcua_status, opcua_reg_hb_node_id, last_heartbeat_check 
            FROM plcs 
            ORDER BY plc_no
        """)
        plcs = cur.fetchall()
        
        status_results = []
        current_time = datetime.now().isoformat()
        
        for plc_no, opcua_url, stored_plc_status, stored_opcua_status, hb_node_id, last_checked in plcs:
            plc_status = stored_plc_status or "disconnected"
            opcua_status = stored_opcua_status or "disconnected"
            
            try:
                # Try to connect to OPC UA server
                client = Client(opcua_url)
                client.connect()
                
                # OPC UA connection successful
                opcua_status = "connected"
                
                # Check PLC status via heartbeat node if available
                if hb_node_id:
                    try:
                        node = client.get_node(hb_node_id)
                        value = node.get_value()
                        plc_status = "connected" if value else "disconnected"
                    except Exception as e:
                        print(f"Error reading heartbeat for PLC {plc_no}: {e}")
                        plc_status = "disconnected"
                
                client.disconnect()
                
                # Update both statuses in database
                cur.execute(
                    "UPDATE plcs SET plc_status = ?, opcua_status = ?, last_heartbeat_check = ? WHERE plc_no = ?",
                    (plc_status, opcua_status, current_time, plc_no)
                )
                
                # Determine overall connection status
                is_connected = opcua_status == "connected"
                overall_status = "active" if is_connected else "error"
                message = f"OPC UA: {opcua_status}, PLC: {plc_status}"
                
                status_results.append({
                    "plc_id": f"plc_{plc_no}",
                    "plc_no": plc_no,
                    "plc_ip": opcua_url.split("://")[1].split(":")[0] if "://" in opcua_url else "unknown",
                    "opcua_url": opcua_url,
                    "plc_status": plc_status,
                    "opcua_status": opcua_status,
                    "is_connected": is_connected,
                    "status": overall_status,
                    "last_checked": current_time,
                    "message": message
                })
                
            except Exception as e:
                # Connection failed - both statuses disconnected
                plc_status = "disconnected"
                opcua_status = "disconnected"
                
                cur.execute(
                    "UPDATE plcs SET plc_status = ?, opcua_status = ?, last_heartbeat_check = ? WHERE plc_no = ?",
                    (plc_status, opcua_status, current_time, plc_no)
                )
                
                status_results.append({
                    "plc_id": f"plc_{plc_no}",
                    "plc_no": plc_no,
                    "plc_ip": opcua_url.split("://")[1].split(":")[0] if "://" in opcua_url else "unknown",
                    "opcua_url": opcua_url,
                    "plc_status": plc_status,
                    "opcua_status": opcua_status,
                    "is_connected": False,
                    "status": "error",
                    "last_checked": current_time,
                    "message": f"Connection failed: {str(e)}"
                })
        
        # Commit all status updates
        db_conn.commit()
        
        return status_results
        
    except Exception as e:
        print(f"Error in get_all_plcs_status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get PLCs status: {str(e)}")

#3. Now when the status is connected , recieve the ClientSendNodeNames and send the data through ServerSendDataDict
@app.post("/read_nodes", response_model=ServerSendDataDict)
async def read_nodes(payload: ClientSendNodeNames):
    """
    Given a PLC number and list of node names:
    1. Find their node IDs from DB
    2. Connect to the PLC's OPC UA server
    3. Read current values
    4. Return {node_name: value} dict
    """
    try:
        cur = db_conn.cursor()
        # 0) properly managing the nodes 

        # 1) Get OPC UA server URL for this PLC
        cur.execute("SELECT opcua_url FROM plcs WHERE plc_no = ?", (payload.plc_no,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"PLC {payload.plc_no} not found")
        opcua_url = row[0]

        # 2) Fetch node_ids for the given node_names
        query = f"""
        SELECT node_name, node_id 
        FROM nodes 
        WHERE plc_no = ? AND node_name IN ({','.join(['?']*len(payload.node_names))})
        """
        cur.execute(query, (payload.plc_no, *payload.node_names))
        rows = cur.fetchall()

        if not rows:
            raise HTTPException(status_code=404, detail="No matching nodes found in DB")

        
        #2.1 creating the dictionary with node_names
        node_map = dict(rows)   # {node_name: node_id}

        # 3) Connect to PLC and read values
        client = Client(opcua_url)
        client.connect()

        data = {}
        for name, node_id in node_map.items():
            try:
                node = client.get_node(node_id)
                data[name] = node.get_value()
            except Exception as e:
                data[name] = f"Error: {str(e)}"

        client.disconnect()

        # 4) Return result to client
        return {"data": data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


# 4: Delete PLC and all associated nodes ----
@app.post("/delete_plc", response_model=DeletePLCResponse)
async def delete_plc(payload: DeletePLCRequest):
    """
    Delete a PLC and all its associated nodes from the database.
    Expects payload with plc_no field.
    """
    try:
        if db_conn is None:
            raise HTTPException(status_code=500, detail="Database connection not available")

        cur = db_conn.cursor()
        
        # Check if PLC exists
        cur.execute("SELECT plc_no FROM plcs WHERE plc_no = ?", (payload.plc_no,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"PLC {payload.plc_no} not found")

        # Delete all nodes associated with this PLC first (due to foreign key constraint)
        cur.execute("DELETE FROM nodes WHERE plc_no = ?", (payload.plc_no,))
        nodes_deleted = cur.rowcount
        
        # Delete the PLC record
        cur.execute("DELETE FROM plcs WHERE plc_no = ?", (payload.plc_no,))
        plc_deleted = cur.rowcount
        
        # Commit the transaction
        db_conn.commit()
        
        return {
            "status": "success",
            "message": f"PLC {payload.plc_no} deleted successfully",
            "plc_deleted": plc_deleted,
            "nodes_deleted": nodes_deleted
        }

    except HTTPException:
        raise
    except Exception as e:
        # Rollback in case of error
        if db_conn:
            db_conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete PLC: {str(e)}")
