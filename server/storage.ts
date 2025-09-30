import { type PLC, type PLCConfig, mockPLCs, plcs, variables } from "@shared/schema";
import { normalizePLCConfig } from "@shared/normalization";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and } from "drizzle-orm";

// Storage interface for OPC UA Dashboard
export interface IStorage {
  // PLC management
  getAllPLCs(includeMappings?: boolean): Promise<PLC[]>;
  getPLCById(id: string): Promise<PLC | undefined>;
  createPLC(config: PLCConfig): Promise<PLC>;
  updatePLC(id: string, updates: Partial<PLC>): Promise<PLC | undefined>;
  deletePLC(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private plcs: Map<string, PLC>;

  constructor() {
    this.plcs = new Map();

    // Initialize with mock PLCs from schema (synchronous)
    mockPLCs.forEach(plc => {
      this.plcs.set(plc.id, plc);
    });
  }

  async getAllPLCs(includeMappings?: boolean): Promise<PLC[]> {
    return Array.from(this.plcs.values());
  }

  async getPLCById(id: string): Promise<PLC | undefined> {
    return this.plcs.get(id);
  }

  async createPLC(config: PLCConfig): Promise<PLC> {
    const id = randomUUID();
    const plc: PLC = {
      ...config,
      id,
      plc_status: "disconnected",
      opcua_status: "disconnected",
      last_checked: new Date(),
      created_at: new Date(),
    };
    this.plcs.set(id, plc);
    return plc;
  }

  async updatePLC(id: string, updates: Partial<PLC>): Promise<PLC | undefined> {
    const existing = this.plcs.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates };
    this.plcs.set(id, updated);
    return updated;
  }

  async deletePLC(id: string): Promise<boolean> {
    return this.plcs.delete(id);
  }
}

export class SqlStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private initialized = false;

  constructor() {
    const sqlite = new Database("./sqlite.db");
    this.db = drizzle(sqlite);
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initDb();
      this.initialized = true;
    }
  }


  private async initDb() {
    // Create tables if they don't exist
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS plcs (
        id TEXT PRIMARY KEY,
        plc_name TEXT NOT NULL,
        plc_no INTEGER,
        plc_ip TEXT NOT NULL,
        opcua_url TEXT NOT NULL,
        plc_status TEXT NOT NULL,
        opcua_status TEXT NOT NULL,
        last_checked INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // Add new columns if they don't exist (for migration)
    try {
      await this.db.run(`ALTER TABLE plcs ADD COLUMN plc_status TEXT DEFAULT 'disconnected'`);
    } catch (e) {
      // Column might already exist
    }
    try {
      await this.db.run(`ALTER TABLE plcs ADD COLUMN opcua_status TEXT DEFAULT 'disconnected'`);
    } catch (e) {
      // Column might already exist
    }

    await this.db.run(`
      CREATE TABLE IF NOT EXISTS variables (
        id TEXT PRIMARY KEY,
        plc_no INTEGER NOT NULL,
        node_name TEXT NOT NULL,
        description TEXT,
        reg_address TEXT NOT NULL,
        data_type TEXT NOT NULL,
        user_description TEXT
      )
    `);

    // Database tables are ready - data persists between restarts
  }

  async getAllPLCs(includeMappings: boolean = true): Promise<PLC[]> {
    await this.ensureInitialized();
    const plcRows = await this.db.select().from(plcs);
    const result: PLC[] = [];

    for (const plcRow of plcRows) {
      try {
        let address_mappings: any[] = [];
        if (includeMappings) {
          const variablesData = await this.db.select().from(variables).where(eq(variables.plc_no, plcRow.plc_no || 1));
          address_mappings = variablesData.map(v => ({
            node_name: v.node_name,
            node_id: v.reg_address,
            description: v.description || undefined,
            data_type: v.data_type,
          }));
        }

        const plc: PLC = {
          ...plcRow,
          plc_no: plcRow.plc_no || undefined,
          plc_status: plcRow.plc_status as "connected" | "disconnected",
          opcua_status: plcRow.opcua_status as "connected" | "disconnected",
          last_checked: new Date(plcRow.last_checked),
          created_at: new Date(plcRow.created_at),
          address_mappings,
        };
        result.push(plc);
      } catch (error) {
        console.error(`Error processing PLC ${plcRow.id}:`, error);
        // Skip this PLC but continue with others
      }
    }

    return result;
  }

  async getPLCById(id: string): Promise<PLC | undefined> {
    await this.ensureInitialized();
    const plcRow = await this.db.select().from(plcs).where(eq(plcs.id, id)).limit(1);
    if (plcRow.length === 0) return undefined;

    try {
      const variablesData = await this.db.select().from(variables).where(eq(variables.plc_no, plcRow[0].plc_no || 1));
      return {
        ...plcRow[0],
        plc_no: plcRow[0].plc_no || undefined,
        plc_status: plcRow[0].plc_status as "connected" | "disconnected",
        opcua_status: plcRow[0].opcua_status as "connected" | "disconnected",
        last_checked: new Date(plcRow[0].last_checked),
        created_at: new Date(plcRow[0].created_at),
        address_mappings: variablesData.map(v => ({
          node_name: v.node_name,
          node_id: v.reg_address,
          description: v.description || undefined,
          data_type: v.data_type,
        })),
      };
    } catch (error) {
      console.error(`Error processing PLC ${id}:`, error);
      return undefined;
    }
  }

  async createPLC(config: PLCConfig): Promise<PLC> {
    // Check if PLC with this IP already exists
    const existingPLC = await this.db.select().from(plcs).where(eq(plcs.plc_ip, config.plc_ip)).limit(1);
    if (existingPLC.length > 0) {
      throw new Error(`PLC with IP ${config.plc_ip} is already registered. To change it, delete the existing PLC and reupload the file.`);
    }

    const id = randomUUID();
    const now = new Date();
    const plcData = {
      id,
      plc_name: config.plc_name,
      plc_no: config.plc_no,
      plc_ip: config.plc_ip,
      opcua_url: config.opcua_url,
      plc_status: "disconnected" as const,
      opcua_status: "disconnected" as const,
      last_checked: now,
      created_at: now,
    };

    await this.db.insert(plcs).values({
      id: plcData.id,
      plc_name: plcData.plc_name,
      plc_no: plcData.plc_no,
      plc_ip: plcData.plc_ip,
      opcua_url: plcData.opcua_url,
      plc_status: plcData.plc_status,
      opcua_status: plcData.opcua_status,
      last_checked: plcData.last_checked.getTime(),
      created_at: plcData.created_at.getTime(),
    });

    // Insert variables into variables table
    for (const mapping of config.address_mappings) {
      await this.db.insert(variables).values({
        id: randomUUID(),
        plc_no: plcData.plc_no || 1,
        node_name: mapping.node_name,
        description: mapping.description || "",
        reg_address: mapping.node_id,
        data_type: mapping.data_type || "string",
        user_description: null,
      });
    }

    return {
      ...plcData,
      plc_status: plcData.plc_status,
      opcua_status: plcData.opcua_status,
      address_mappings: config.address_mappings,
    };
  }

  async createPLCFromRaw(rawConfig: any): Promise<PLC> {
    // Check if PLC with this IP already exists
    const existingPLC = await this.db.select().from(plcs).where(eq(plcs.plc_ip, rawConfig.plc_ip)).limit(1);
    if (existingPLC.length > 0) {
      throw new Error(`PLC with IP ${rawConfig.plc_ip} is already registered. To change it, delete the existing PLC and reupload the file.`);
    }

    const id = randomUUID();
    const now = new Date();
    const plcData = {
      id,
      plc_name: rawConfig.plc_name,
      plc_no: rawConfig.plc_no,
      plc_ip: rawConfig.plc_ip,
      opcua_url: rawConfig.opcua_url,
      plc_status: "disconnected" as const,
      opcua_status: "disconnected" as const,
      last_checked: now,
      created_at: now,
    };

    await this.db.insert(plcs).values({
      id: plcData.id,
      plc_name: plcData.plc_name,
      plc_no: plcData.plc_no,
      plc_ip: plcData.plc_ip,
      opcua_url: plcData.opcua_url,
      plc_status: plcData.plc_status,
      opcua_status: plcData.opcua_status,
      last_checked: plcData.last_checked.getTime(),
      created_at: plcData.created_at.getTime(),
    });

    // Insert variables
    for (const mapping of rawConfig.address_mappings) {
      // Check if this mapping has metadata with bit mappings
      if (mapping.metadata?.bit_mappings) {
        console.log(`Processing bit mappings for ${mapping.opcua_reg_add}:`, mapping.metadata.bit_mappings);
        const bitMappings = mapping.metadata.bit_mappings;
        // This is a channel with bit mappings - create ONLY individual bit variables, NOT the channel record
        for (const bitKey of Object.keys(bitMappings)) {
          const bitData = bitMappings[bitKey] as { address: string; description: string; bit_position: number };
          await this.db.insert(variables).values({
            id: randomUUID(),
            plc_no: plcData.plc_no || 1,
            node_name: `${mapping.opcua_reg_add}_${bitKey.padStart(2, '0')}`,
            description: bitData.description,
            reg_address: bitData.address,
            data_type: "bool",
            user_description: null,
          });
        }
        // DO NOT create a variable record for the channel itself
      } else {
        // Regular variable without bit mappings
        await this.db.insert(variables).values({
          id: randomUUID(),
          plc_no: plcData.plc_no || 1,
          node_name: mapping.opcua_reg_add,
          description: mapping.description || "",
          reg_address: mapping.plc_reg_add,
          data_type: mapping.data_type || "string",
          user_description: null,
        });
      }
    }

    return {
      ...plcData,
      plc_status: plcData.plc_status,
      opcua_status: plcData.opcua_status,
      address_mappings: rawConfig.address_mappings.map((m: any) => ({
        node_name: m.opcua_reg_add,
        node_id: m.plc_reg_add,
        description: m.description,
        data_type: m.data_type,
      })),
    };
  }

  async updatePLC(id: string, updates: Partial<PLC>): Promise<PLC | undefined> {
    const existing = await this.getPLCById(id);
    if (!existing) return undefined;

    const updateData: any = {};
    if (updates.plc_name !== undefined) updateData.plc_name = updates.plc_name;
    if (updates.plc_no !== undefined) updateData.plc_no = updates.plc_no;
    if (updates.plc_ip !== undefined) updateData.plc_ip = updates.plc_ip;
    if (updates.opcua_url !== undefined) updateData.opcua_url = updates.opcua_url;
    if (updates.plc_status !== undefined) updateData.plc_status = updates.plc_status;
    if (updates.opcua_status !== undefined) updateData.opcua_status = updates.opcua_status;
    if (updates.last_checked !== undefined) updateData.last_checked = updates.last_checked.getTime();

    if (Object.keys(updateData).length > 0) {
      await this.db.update(plcs).set(updateData).where(eq(plcs.id, id));
    }

    return this.getPLCById(id);
  }

  async deletePLC(id: string): Promise<boolean> {
    // Get PLC data to find plc_no for variables table
    const plcToDelete = await this.db.select().from(plcs).where(eq(plcs.id, id)).limit(1);
    if (plcToDelete.length === 0) {
      return false;
    }
    const plcNo = plcToDelete[0].plc_no;

    // Delete variables associated with this PLC's plc_no
    if (plcNo !== null && plcNo !== undefined) {
      await this.db.delete(variables).where(eq(variables.plc_no, plcNo));
    }

    const result = await this.db.delete(plcs).where(eq(plcs.id, id));
    return result.changes > 0;
  }

}

export const storage = new SqlStorage();
