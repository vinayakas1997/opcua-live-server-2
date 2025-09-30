import { z } from "zod";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Raw JSON PLC Configuration Schema (as uploaded)
export const rawPLCConfigSchema = z.object({
  plc_name: z.string().min(1, "PLC name is required"),
  plc_no: z.number().int().positive("PLC number must be positive"),
  plc_ip: z.string().ip("Invalid IP address"),
  opcua_url: z.string().url("Invalid OPC UA URL"),
  address_mappings: z.array(z.object({
    plc_reg_add: z.string(),
    data_type: z.string(), // Accept any string data type (word, bool, channel, udint, etc.)
    opcua_reg_add: z.string(),
    description: z.string(),
    Memory_Area: z.string().optional(),
    metadata: z.object({
      bit_count: z.number(),
      bit_mappings: z.record(z.object({
        address: z.string(),
        description: z.string(),
        bit_position: z.number(),
      })),
    }).optional(),
  })),
});

// Raw JSON file structure
export const rawJSONSchema = z.object({
  plcs: z.array(rawPLCConfigSchema),
});

// Internal PLC Configuration Schema (for API)
export const plcConfigSchema = z.object({
  plc_name: z.string().min(1, "PLC name is required"),
  plc_no: z.number().int().positive("PLC number must be positive").optional(),
  plc_ip: z.string().ip("Invalid IP address"),
  opcua_url: z.string().url("Invalid OPC UA URL"),
  address_mappings: z.array(z.object({
    node_name: z.string(),
    node_id: z.string(),
    description: z.string().optional(),
    data_type: z.string().optional(),
  })),
});

// PLC with status and runtime info
export const plcSchema = plcConfigSchema.extend({
  id: z.string(),
  plc_status: z.enum(["connected", "disconnected"]),
  opcua_status: z.enum(["connected", "disconnected"]),
  last_checked: z.date(),
  created_at: z.date(),
});

// OPC UA Node Data
export const nodeDataSchema = z.object({
  node_id: z.string(),
  node_name: z.string(),
  current_value: z.any(),
  timestamp: z.date(),
  quality: z.string().optional(),
  data_type: z.string().optional(),
});

// Server Connection Status
export const serverStatusSchema = z.object({
  opcua_url: z.string(),
  is_connected: z.boolean(),
  status: z.enum(["active", "inactive", "error"]),
  last_update: z.date(),
  node_count: z.number().optional(),
});

// User Description Schema for storing custom descriptions
export const userDescriptionSchema = z.object({
  id: z.string(),
  plc_id: z.string(),
  node_id: z.string(),
  user_description: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type RawPLCConfig = z.infer<typeof rawPLCConfigSchema>;
export type RawJSONData = z.infer<typeof rawJSONSchema>;
export type PLCConfig = z.infer<typeof plcConfigSchema>;
export type PLC = z.infer<typeof plcSchema>;
export type NodeData = z.infer<typeof nodeDataSchema>;
export type ServerStatus = z.infer<typeof serverStatusSchema>;
export type UserDescription = z.infer<typeof userDescriptionSchema>;
export type PLCStatus = "connected" | "disconnected";
export type ConnectionStatus = "connected" | "disconnected";

// Language types
export type Language = "en" | "jp";

// Database tables
export const plcs = sqliteTable("plcs", {
  id: text("id").primaryKey(),
  plc_name: text("plc_name").notNull(),
  plc_no: integer("plc_no"),
  plc_ip: text("plc_ip").notNull(),
  opcua_url: text("opcua_url").notNull(),
  plc_status: text("plc_status").notNull(),
  opcua_status: text("opcua_status").notNull(),
  last_checked: integer("last_checked").notNull(),
  created_at: integer("created_at").notNull(),
});


export const variables = sqliteTable("variables", {
  id: text("id").primaryKey(),
  plc_no: integer("plc_no").notNull(),
  node_name: text("node_name").notNull(),
  description: text("description"),
  reg_address: text("reg_address").notNull(),
  data_type: text("data_type").notNull(),
  user_description: text("user_description"),
});


// Mock data for development
export const mockPLCs: PLC[] = [
  {
    id: "1",
    plc_name: "Production Line A Controller",
    plc_no: 101,
    plc_ip: "192.168.1.10",
    opcua_url: "opc.tcp://192.168.1.10:4840",
    address_mappings: [
      { node_name: "Temperature_01", node_id: "ns=2;i=1001", description: "Main temperature sensor", data_type: "Float" },
      { node_name: "Pressure_01", node_id: "ns=2;i=1002", description: "System pressure", data_type: "Float" },
      { node_name: "Motor_Speed", node_id: "ns=2;i=1003", description: "Motor RPM", data_type: "Int32" },
    ],
    plc_status: "connected",
    opcua_status: "connected",
    last_checked: new Date(),
    created_at: new Date(),
  },
  {
    id: "2",
    plc_name: "Packaging Unit B",
    plc_no: 102,
    plc_ip: "192.168.1.11",
    opcua_url: "opc.tcp://192.168.1.11:4840",
    address_mappings: [
      { node_name: "Conveyor_Speed", node_id: "ns=2;i=2001", description: "Conveyor belt speed", data_type: "Float" },
      { node_name: "Package_Count", node_id: "ns=2;i=2002", description: "Total packages", data_type: "Int32" },
    ],
    plc_status: "disconnected",
    opcua_status: "disconnected",
    last_checked: new Date(),
    created_at: new Date(),
  },
  {
    id: "3",
    plc_name: "Quality Control System",
    plc_no: 103,
    plc_ip: "192.168.1.12",
    opcua_url: "opc.tcp://192.168.1.12:4840",
    address_mappings: [
      { node_name: "Test_Result", node_id: "ns=2;i=3001", description: "Quality test result", data_type: "Boolean" },
      { node_name: "Error_Count", node_id: "ns=2;i=3002", description: "Error counter", data_type: "Int32" },
    ],
    plc_status: "disconnected",
    opcua_status: "disconnected",
    last_checked: new Date(),
    created_at: new Date(),
  },
];

export const mockNodeData: NodeData[] = [
  {
    node_id: "ns=2;i=1001",
    node_name: "Temperature_01",
    current_value: 23.5,
    timestamp: new Date(),
    quality: "Good",
    data_type: "Float",
  },
  {
    node_id: "ns=2;i=1002",
    node_name: "Pressure_01",
    current_value: 1.2,
    timestamp: new Date(),
    quality: "Good",
    data_type: "Float",
  },
  {
    node_id: "ns=2;i=1003",
    node_name: "Motor_Speed",
    current_value: 1450,
    timestamp: new Date(),
    quality: "Good",
    data_type: "Int32",
  },
];
