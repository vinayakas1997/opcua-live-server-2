import type { PLC, PLCConfig } from "@shared/schema";

const API_BASE = "/api";

export const api = {
  // PLC Management
  async getAllPLCs(): Promise<PLC[]> {
    const response = await fetch(`${API_BASE}/plcs`);
    if (!response.ok) throw new Error("Failed to fetch PLCs");
    return response.json();
  },

  async getAllPLCsWithMappings(): Promise<PLC[]> {
    const response = await fetch(`${API_BASE}/plcs?includeMappings=true`);
    if (!response.ok) throw new Error("Failed to fetch PLCs");
    return response.json();
  },

  async getPLCById(id: string): Promise<PLC> {
    const response = await fetch(`${API_BASE}/plcs/${id}`);
    if (!response.ok) throw new Error("Failed to fetch PLC");
    return response.json();
  },

  async createPLC(config: PLCConfig): Promise<PLC> {
    const response = await fetch(`${API_BASE}/plcs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error("Failed to create PLC");
    return response.json();
  },

  async updatePLC(id: string, updates: Partial<PLC>): Promise<PLC> {
    const response = await fetch(`${API_BASE}/plcs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error("Failed to update PLC");
    return response.json();
  },

  async deletePLC(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/plcs/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete PLC");
  },

  // Connection Management
  async connectPLC(id: string): Promise<PLC> {
    const response = await fetch(`${API_BASE}/plcs/${id}/connect`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to connect PLC");
    return response.json();
  },

  async disconnectPLC(id: string): Promise<PLC> {
    const response = await fetch(`${API_BASE}/plcs/${id}/disconnect`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to disconnect PLC");
    return response.json();
  },

  async checkPLCStatus(id: string): Promise<{
    plc_id: string;
    plc_no: number;
    opcua_url: string;
    is_connected: boolean;
    status: string;
    last_checked: string;
    message: string;
    backend_response: boolean;
  }> {
    const response = await fetch(`${API_BASE}/plcs/${id}/check-status`);
    if (!response.ok) throw new Error("Failed to check PLC status");
    return response.json();
  },

  async getAllPLCsStatus(): Promise<Array<{
    plc_id: string;
    plc_no: number;
    plc_ip: string;
    opcua_url: string;
    plc_status: string;
    opcua_status: string;
    is_connected: boolean;
    status: string;
    last_checked: string;
    message: string;
  }>> {
    const response = await fetch(`${API_BASE}/plcs/all-status`);
    if (!response.ok) throw new Error("Failed to fetch all PLCs status");
    return response.json();
  },

  // File Upload
  async uploadJSONConfig(file: File): Promise<{ success: boolean; plc: PLC }> {
    const formData = new FormData();
    formData.append("jsonFile", file);

    const response = await fetch(`${API_BASE}/upload/json`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to upload file");
    }

    return response.json();
  },
};
