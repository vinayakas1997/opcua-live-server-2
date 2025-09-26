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


#2. get all the nodes names from the server and save to the db