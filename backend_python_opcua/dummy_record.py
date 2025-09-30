import sqlite3
from datetime import datetime

# Connect to your DB (or create if not exists)
conn = sqlite3.connect("opcua.db")
cursor = conn.cursor()

# # Create table if not exists
# cursor.execute("""
# CREATE TABLE IF NOT EXISTS plcs (
#     plc_no INTEGER PRIMARY KEY,
#     opcua_url TEXT NOT NULL,
#     opcua_reg_hb_name TEXT NOT NULL,
#     opcua_reg_hb_node_id TEXT NOT NULL,
#     plc_status TEXT DEFAULT 'disconnected',
#     opcua_status TEXT DEFAULT 'disconnected',
#     nodes_count INTEGER DEFAULT 0,
#     last_heartbeat_check TIMESTAMP
# )
# """)

# Insert dummy record
cursor.execute("""
INSERT INTO plcs (plc_no, opcua_url, opcua_reg_hb_name, opcua_reg_hb_node_id, plc_status, opcua_status, nodes_count, last_heartbeat_check)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
""", (
    3,
    "opc.tcp://192.168.1.20:4840",
    "P3_running",
    "ns=2;s=Demo.Heartbeat",
    "connected",
    "connected",
    10,
    datetime.now()
))

conn.commit()
conn.close()
print("✅ Dummy record inserted!")
