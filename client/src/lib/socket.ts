import { io, Socket } from "socket.io-client";

class SocketManager {
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) return this.socket;

    this.socket = io("http://localhost:5000", {
      autoConnect: true,
    });

    this.socket.on("connect", () => {
      console.log("Connected to WebSocket server");
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  subscribeToPLC(plcId: string) {
    if (this.socket) {
      this.socket.emit("subscribePLC", plcId);
    }
  }

  unsubscribeFromPLC(plcId: string) {
    if (this.socket) {
      this.socket.emit("unsubscribePLC", plcId);
    }
  }
}

export const socketManager = new SocketManager();