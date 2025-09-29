import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from opcua import Client, ua
from typing import Any, Dict, List, Optional
from db_opcua import init_db, get_connection , register_plc_and_nodes


# ---- Shared Models ----
class Status(BaseModel):
    plc_no: Optional[int] = None
    status: str

# ---- Client -> Server ----
class ClientSendOpcuaUrl(BaseModel):
    plc_no: int
    opcua_url: str

class ClientSendNodeNames(BaseModel):
    plc_no: int
    node_names: List[str]

# ---- Server -> Client ----
class ServerSendDataDict(BaseModel):
    data: Dict[str, Any]


# ---- Global connection holder ----
db_conn = None  

# ---- Lifespan context ----
@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_conn
    # Startup
    init_db()
    db_conn = get_connection()
    print("✅ Database initialized and connected.")
    yield
    # Shutdown
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
@app.get("/")
async def root():
    return {"message": "FastAPI OPC UA backend is running 🚀"}

# 1: connect and register PLC + nodes ----
@app.post("/connect")
async def connect_plc(payload: ClientSendOpcuaUrl):
    """
    Connects to the PLC's OPC UA server, browses all nodes, filters them
    according to naming convention, and stores both PLC info and nodes in DB.
    """
    result = register_plc_and_nodes(payload.plc_no, payload.opcua_url, db_conn)

    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))

    return {
        "status": "connected",
        "plc_no": payload.plc_no,
        "nodes_registered": result.get("nodes_count", 0)
    }


#2. Now when the status is connected , recieve the ClientSendNodeNames and send the data through ServerSendDataDict
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
