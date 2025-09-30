import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import multer from "multer";
import { storage } from "./storage";
import { plcConfigSchema, rawJSONSchema } from "@shared/schema";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // PLC Management Routes
  app.get("/api/plcs", async (req, res) => {
    try {
      const includeMappings = req.query.includeMappings === 'true';
      const plcs = await storage.getAllPLCs(includeMappings);
      res.json(plcs);
    } catch (error) {
      console.error("Error fetching PLCs:", error);
      res.status(500).json({ error: "Failed to fetch PLCs" });
    }
  });

  app.get("/api/plcs/:id", async (req, res) => {
    try {
      const plc = await storage.getPLCById(req.params.id);
      if (!plc) {
        return res.status(404).json({ error: "PLC not found" });
      }
      res.json(plc);
    } catch (error) {
      console.error("Error fetching PLC:", error);
      res.status(500).json({ error: "Failed to fetch PLC" });
    }
  });

  app.post("/api/plcs", async (req, res) => {
    try {
      const config = plcConfigSchema.parse(req.body);
      const plc = await storage.createPLC(config);
      res.status(201).json(plc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("PLC validation error:", error.errors);
        return res.status(400).json({ error: "Invalid PLC configuration", details: error.errors });
      }
      console.error("Error creating PLC:", error);
      res.status(500).json({ error: "Failed to create PLC" });
    }
  });

  app.put("/api/plcs/:id", async (req, res) => {
    try {
      const updates = req.body;
      const plc = await storage.updatePLC(req.params.id, updates);
      if (!plc) {
        return res.status(404).json({ error: "PLC not found" });
      }
      res.json(plc);
    } catch (error) {
      console.error("Error updating PLC:", error);
      res.status(500).json({ error: "Failed to update PLC" });
    }
  });

  app.delete("/api/plcs/:id", async (req, res) => {
    try {
      // First get the PLC to extract plc_no for backend deletion
      const plc = await storage.getPLCById(req.params.id);
      if (!plc) {
        return res.status(404).json({ error: "PLC not found" });
      }

      // Delete from Python backend database if plc_no exists
      if (plc.plc_no) {
        try {
          const backendResponse = await fetch("http://localhost:8000/delete_plc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plc_no: plc.plc_no,
            }),
          });

          if (!backendResponse.ok) {
            const errorData = await backendResponse.json().catch(() => ({}));
            console.warn(`Backend deletion failed: ${errorData.detail || backendResponse.statusText}`);
            // Continue with frontend deletion even if backend fails
          } else {
            const backendData = await backendResponse.json();
            console.log(`Backend deletion successful: ${backendData.message}`);
          }
        } catch (backendError) {
          console.warn("Failed to call backend delete:", backendError);
          // Continue with frontend deletion even if backend call fails
        }
      }

      // Delete from frontend storage
      const deleted = await storage.deletePLC(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "PLC not found in frontend storage" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting PLC:", error);
      res.status(500).json({ error: "Failed to delete PLC" });
    }
  });

  // PLC Connection Management
  app.post("/api/plcs/:id/connect", async (req, res) => {
    try {
      const plc = await storage.getPLCById(req.params.id);
      if (!plc) {
        return res.status(404).json({ error: "PLC not found" });
      }

      if (!plc.plc_no || !plc.opcua_url) {
        return res.status(400).json({ error: "PLC missing plc_no or opcua_url" });
      }

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const backendResponse = await fetch("http://localhost:8000/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plc_no: plc.plc_no,
          opcua_url: plc.opcua_url,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let updatedStatus: "active" | "error" = "error";
      let isConnected = false;

      if (backendResponse.ok) {
        const backendData = await backendResponse.json();
        if (backendData.status === "connected") {
          updatedStatus = "active";
          isConnected = true;
        }
      }

      const updatedPLC = await storage.updatePLC(req.params.id, {
        status: updatedStatus,
        is_connected: isConnected,
        last_checked: new Date(),
      });

      if (!updatedPLC) {
        return res.status(500).json({ error: "Failed to update PLC status" });
      }

      res.json(updatedPLC);
    } catch (error) {
      console.error("Error connecting PLC:", error);
      // On any error, ensure status is error
      try {
        await storage.updatePLC(req.params.id, {
          status: "error",
          is_connected: false,
          last_checked: new Date(),
        });
      } catch (updateError) {
        console.error("Failed to update error status:", updateError);
      }
      res.status(500).json({ error: "Failed to connect PLC" });
    }
  });

  app.post("/api/plcs/:id/disconnect", async (req, res) => {
    try {
      const plc = await storage.updatePLC(req.params.id, {
        is_connected: false,
        status: "maintenance",
        last_checked: new Date(),
      });
      if (!plc) {
        return res.status(404).json({ error: "PLC not found" });
      }
      res.json(plc);
    } catch (error) {
      console.error("Error disconnecting PLC:", error);
      res.status(500).json({ error: "Failed to disconnect PLC" });
    }
  });

  // Bulk PLC Status Check - gets status for all PLCs with separate PLC and OPC UA statuses
  app.get("/api/plcs/all-status", async (req, res) => {
    try {
      // Get PLCs from our database first
      const plcs = await storage.getAllPLCs(false);
      
      if (plcs.length === 0) {
        return res.json([]); // Return empty array if no PLCs
      }

      let pythonStatusResults = [];
      
      try {
        // Call Python backend's new bulk status endpoint
        const backendResponse = await fetch("http://localhost:8000/all-status", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (backendResponse.ok) {
          pythonStatusResults = await backendResponse.json();
        } else {
          console.warn(`Python backend returned ${backendResponse.status}, using frontend data only`);
        }
      } catch (backendError) {
        console.warn("Python backend not available, using frontend data only:", backendError);
      }

      const plcMap = new Map(plcs.map(plc => [plc.plc_no, plc]));
      const statusResults = [];

      // If we have Python backend results, use them
      for (const pythonStatus of pythonStatusResults) {
        const plc = plcMap.get(pythonStatus.plc_no);
        
        if (plc) {
          // Update PLC status in our database
          const connectionStatus = pythonStatus.status === "active" ? "active" : "error";
          await storage.updatePLC(plc.id, {
            status: connectionStatus,
            is_connected: pythonStatus.is_connected,
            last_checked: new Date(),
          });

          statusResults.push({
            plc_id: plc.id, // Use our database ID
            plc_no: pythonStatus.plc_no,
            plc_ip: plc.plc_ip, // Use our stored IP
            opcua_url: pythonStatus.opcua_url,
            plc_status: pythonStatus.plc_status,
            opcua_status: pythonStatus.opcua_status,
            is_connected: pythonStatus.is_connected,
            status: connectionStatus,
            last_checked: pythonStatus.last_checked,
            message: pythonStatus.message
          });
          
          // Remove from map so we don't process it again
          plcMap.delete(pythonStatus.plc_no);
        }
      }

      // For PLCs not in Python backend, return frontend data with disconnected status
      for (const [plc_no, plc] of Array.from(plcMap)) {
        statusResults.push({
          plc_id: plc.id,
          plc_no: plc.plc_no || 0,
          plc_ip: plc.plc_ip,
          opcua_url: plc.opcua_url,
          plc_status: "disconnected",
          opcua_status: "disconnected",
          is_connected: false,
          status: "error",
          last_checked: new Date().toISOString(),
          message: "Not connected to backend"
        });
      }

      res.json(statusResults);
    } catch (error) {
      console.error("Error checking all PLCs status:", error);
      res.status(500).json({ 
        error: "Failed to check PLCs status",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // PLC Status Check - calls Python backend to verify connection
  app.get("/api/plcs/:id/check-status", async (req, res) => {
    try {
      // 1. Get PLC data from database using plc_id
      const plc = await storage.getPLCById(req.params.id);
      if (!plc) {
        return res.status(404).json({ error: "PLC not found" });
      }

      if (!plc.plc_no || !plc.opcua_url) {
        return res.status(400).json({ error: "PLC missing plc_no or opcua_url" });
      }

      // 2. Call Python backend /connect to check status
      const backendResponse = await fetch("http://localhost:8000/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plc_no: plc.plc_no,
          opcua_url: plc.opcua_url,
        }),
      });

      // 3. Process response and determine status
      let connectionStatus: "active" | "error" = "error";
      let isConnected = false;
      let backendMessage = "";

      if (backendResponse.ok) {
        const backendData = await backendResponse.json();
        if (backendData.status === "connected") {
          connectionStatus = "active";
          isConnected = true;
          backendMessage = `Connected successfully. ${backendData.nodes_registered || 0} nodes registered.`;
        } else {
          backendMessage = "Backend responded but connection failed";
        }
      } else {
        const errorData = await backendResponse.json().catch(() => ({}));
        backendMessage = errorData.detail || `HTTP ${backendResponse.status}: ${backendResponse.statusText}`;
      }

      // 4. Update PLC status in database
      const updatedPLC = await storage.updatePLC(req.params.id, {
        status: connectionStatus,
        is_connected: isConnected,
        last_checked: new Date(),
      });

      // 5. Return status to frontend
      res.json({
        plc_id: req.params.id,
        plc_no: plc.plc_no,
        opcua_url: plc.opcua_url,
        is_connected: isConnected,
        status: connectionStatus,
        last_checked: new Date(),
        message: backendMessage,
        backend_response: backendResponse.ok
      });

    } catch (error) {
      console.error("Error checking PLC status:", error);
      
      // On any error, ensure status is error
      try {
        await storage.updatePLC(req.params.id, {
          status: "error",
          is_connected: false,
          last_checked: new Date(),
        });
      } catch (updateError) {
        console.error("Failed to update error status:", updateError);
      }
      
      res.status(500).json({ 
        error: "Failed to check PLC status",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // JSON Upload Route
  app.post("/api/upload/json", upload.single("jsonFile"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString("utf-8");
      const json = JSON.parse(fileContent);
      const rawConfig = rawJSONSchema.parse(json);

      // Create the PLC in the database using raw config to handle bit mappings
      const plc = await (storage as any).createPLCFromRaw(rawConfig.plcs[0]);

      res.json({ success: true, plc });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid JSON configuration", details: error.errors });
      }
      if (error instanceof SyntaxError) {
        return res.status(400).json({ error: "Invalid JSON format" });
      }
      const errorMessage = error instanceof Error ? error.message : "Failed to process file";
      console.error("Error processing upload:", error);
      res.status(500).json({ error: `Error processing upload: ${errorMessage}` });
    }
  });

  const httpServer = createServer(app);

  // Set up Socket.IO for real-time updates
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Send initial data
    socket.emit("plcs", []);

    // Handle PLC subscription
    socket.on("subscribePLC", (plcId) => {
      console.log(`Client ${socket.id} subscribed to PLC ${plcId}`);
      socket.join(`plc-${plcId}`);
    });

    socket.on("unsubscribePLC", (plcId) => {
      console.log(`Client ${socket.id} unsubscribed from PLC ${plcId}`);
      socket.leave(`plc-${plcId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return httpServer;
}
