import sqlite3
from opcua import Client, ua
import socket

DB_NAME = "opcua.db"

def get_connection():
    return sqlite3.connect(DB_NAME, check_same_thread=False)

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Create table for PLCs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS plcs (
        plc_no INTEGER PRIMARY KEY,
        opcua_url TEXT NOT NULL,
        opcua_reg_hb_name TEXT NOT NULL,
        opcua_reg_hb_node_id TEXT NOT NULL,
        plc_status TEXT DEFAULT 'disconnected',
        opcua_status TEXT DEFAULT 'disconnected',
        nodes_count INTEGER DEFAULT 0,
        last_heartbeat_check TIMESTAMP
    )
    """)

    # Add new columns to existing table if they don't exist
    try:
        cursor.execute("ALTER TABLE plcs ADD COLUMN plc_status TEXT DEFAULT 'disconnected'")
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    try:
        cursor.execute("ALTER TABLE plcs ADD COLUMN opcua_status TEXT DEFAULT 'disconnected'")
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # Migrate existing data: copy old 'status' to both new columns if they exist
    try:
        cursor.execute("UPDATE plcs SET plc_status = status, opcua_status = status WHERE plc_status IS NULL OR opcua_status IS NULL")
    except sqlite3.OperationalError:
        pass  # Migration not needed

    # Create table for nodes
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plc_no INTEGER NOT NULL,
        node_name TEXT NOT NULL,
        node_id TEXT NOT NULL,
        UNIQUE(plc_no, node_name),
        FOREIGN KEY (plc_no) REFERENCES plcs(plc_no) 
    )
    """)

    conn.commit()
    conn.close()
    

## OPCUA nodes logic 
def recursive_browse(node, nodes_dict):
    """
    Recursively browse OPC UA server starting from 'node'
    and collect variables into nodes_dict {browse_name: node_id}.
    """
    try:
        for child in node.get_children():
            try:
                browse_name = child.get_browse_name().Name
                node_id_str = child.nodeid.to_string()
                node_class = child.get_node_class()

                if node_class == ua.NodeClass.Variable:
                    nodes_dict[browse_name] = node_id_str

                recursive_browse(child, nodes_dict)  # recurse
            except Exception as e:
                print(f"Skipping child node: {e}")
    except Exception as e:
        print(f"Cannot browse node tree: {e}")
    return nodes_dict

def filter_nodes(plc_no: int, nodes_dict: dict):
    """
    Filter nodes that match pattern:
    - start with "P"
    - PLC number matches the given plc_no
    """
    filtered = {}
    for name, node_id in nodes_dict.items():
        if not name.startswith("P"):
            continue

        try:
            parts = name.split("_")
            node_plc_no = int(parts[0][1:])  # take everything after "P" and convert to int
            if node_plc_no == plc_no:
                filtered[name] = node_id
        except (ValueError, IndexError):
            continue  # skip malformed names

    return filtered



def register_plc_and_nodes(plc_no: int, opcua_url: str, db_conn):
    client = Client(opcua_url)
    try:
        client.connect()
        root = client.get_objects_node()
        # print(root)#-- checked 
        # 1. Browse
        all_nodes = recursive_browse(root, {})
        # print(all_nodes)#--checked
        # 2. Filter based on naming convention
        filtered_nodes = filter_nodes(plc_no, all_nodes)
        # print(filtered_nodes) #--checked
        
        # 3. Find the heartbeat/running node
        running_node_name = f"P{plc_no}_running"
        running_node_id = filtered_nodes.get(running_node_name, "")
        
        # 4. After successful browsing, set opcua_status as connected
        opcua_status = "connected"
        
        # 5. Check PLC status by reading the running node value if available
        plc_status = "disconnected"
        if running_node_id:
            try:
                running_node = client.get_node(running_node_id)
                running_value = running_node.get_value()
                plc_status = "connected" if running_value else "disconnected"
            except Exception as e:
                print(f"Error reading running node: {e}")
                plc_status = "disconnected"
        
        # 6. Insert PLC info with separate statuses
        cur = db_conn.cursor()
        cur.execute(
            "INSERT OR REPLACE INTO plcs (plc_no, opcua_url, opcua_reg_hb_name, opcua_reg_hb_node_id, plc_status, opcua_status, nodes_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (plc_no, opcua_url, running_node_name if running_node_id else "", running_node_id, plc_status, opcua_status, len(filtered_nodes))
        )

        # 7. Insert all nodes into nodes table
        for name, node_id in filtered_nodes.items():
            cur.execute(
                "INSERT OR IGNORE INTO nodes (plc_no, node_name, node_id) VALUES (?, ?, ?)",
                (plc_no, name, node_id)
            )
            
        db_conn.commit()

        return {"status": "success", "nodes_count": len(filtered_nodes), "plc_status": plc_status, "opcua_status": opcua_status}

    except socket.gaierror:
        # Cannot resolve hostname / connection failed
        return {"status": "error", "message": "Connection error: could not resolve server address"}

    except ConnectionRefusedError:
        # Server is not running
        return {"status": "error", "message": "Connection refused: OPC UA server not reachable"}

    # except ua.UaStatusCodeError as e:
    #     # OPC UA specific error (e.g., bad session)
    #     return {"status": "error", "message": f"OPC UA server error: {e}"}

    except Exception as e:
        # Fallback for unexpected errors
        return {"status": "error", "message": f"Unexpected error: {str(e)}"}

    finally:
        try:
            client.disconnect()
        except:
            pass
