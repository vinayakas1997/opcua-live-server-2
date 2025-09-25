import type { PLCConfig, PLC, RawJSONData, RawPLCConfig } from "./schema";

// Extract types from schema
type BitMapping = {
  address: string;
  description: string;
  bit_position: number;
};

type AddressMapping = {
  plc_reg_add: string;
  data_type: string;
  opcua_reg_add: string;
  description: string;
  metadata?: {
    bit_count: number;
    bit_mappings: Record<string, BitMapping>;
  };
};

// Normalized data structures for UI consumption
export interface NormalizedVariable {
  id: string;
  type: 'bool' | 'channel';
  plc_reg_add: string;
  opcua_reg_add: string;
  description: string;
  data_type: string;
  parentId?: string; // For bit variables under channel
  bitPosition?: number;
  hasChildren?: boolean;
  children?: NormalizedVariable[];
  isBitRow?: boolean; // For UI display of bit-expanded rows
  metadata?: {
    bit_count: number;
    bit_mappings: Record<string, {
      address: string;
      description: string;
      bit_position: number;
    }>;
  };
}

export interface NormalizedPLC {
  id: string;
  plc_name: string;
  plc_no?: number; // Add plc_no field
  plc_ip: string;
  opcua_url: string;
  status: "active" | "maintenance" | "error";
  last_checked: Date;
  is_connected: boolean;
  created_at: Date;
  variables: NormalizedVariable[];
  registerCount: number;
  boolCount: number;
  channelCount: number;
}

export interface ServerGroup {
  serverUrl: string;
  plcs: NormalizedPLC[];
  connectedCount: number;
  totalCount: number;
  status: 'connected' | 'disconnected';
  lastUpdated: number;
}

/**
 * Normalize a single address mapping into UI-friendly variables
 */
function normalizeAddressMapping(mapping: AddressMapping): NormalizedVariable[] {
  const baseVariable: NormalizedVariable = {
    id: mapping.opcua_reg_add,
    type: mapping.data_type === 'channel' ? 'channel' : 'bool',
    plc_reg_add: mapping.plc_reg_add,
    opcua_reg_add: mapping.opcua_reg_add,
    description: mapping.description,
    data_type: mapping.data_type,
    metadata: mapping.metadata, // Preserve metadata
  };

  // Handle simple bool variables
  if (mapping.data_type === 'bool') {
    return [baseVariable];
  }

  // Handle channel variables with bit mappings
  if (mapping.data_type === 'channel' && mapping.metadata?.bit_mappings) {
    const children: NormalizedVariable[] = [];
    
    // Create child variables for each bit mapping
    Object.entries(mapping.metadata.bit_mappings).forEach(([bitKey, bitData]: [string, BitMapping]) => {
      const childId = `${mapping.opcua_reg_add}:${bitData.bit_position}`;
      
      children.push({
        id: childId,
        type: 'bool',
        plc_reg_add: bitData.address,
        opcua_reg_add: `${mapping.opcua_reg_add}_bit${bitData.bit_position}`,
        description: bitData.description,
        data_type: 'bool',
        parentId: mapping.opcua_reg_add,
        bitPosition: bitData.bit_position,
      });
    });

    // Sort children by bit position
    children.sort((a, b) => (a.bitPosition || 0) - (b.bitPosition || 0));

    // Update parent with children info
    const parentVariable: NormalizedVariable = {
      ...baseVariable,
      hasChildren: true,
      children,
    };

    return [parentVariable, ...children];
  }

  // Fallback for channel without bit mappings
  return [{ ...baseVariable, hasChildren: false }];
}

/**
 * Normalize PLC configuration from JSON into UI-friendly structure
 */
export function normalizePLCConfig(json: RawJSONData): NormalizedPLC[] {
  if (!json.plcs || !Array.isArray(json.plcs)) {
    throw new Error('Invalid JSON structure: missing plcs array');
  }

  return json.plcs.map((plc: RawPLCConfig) => {
    // Normalize all address mappings
    const allVariables: NormalizedVariable[] = [];
    let boolCount = 0;
    let channelCount = 0;

    if (plc.address_mappings && Array.isArray(plc.address_mappings)) {
      plc.address_mappings.forEach((mapping: AddressMapping) => {
        const normalized = normalizeAddressMapping(mapping);
        allVariables.push(...normalized);

        // Count variables by type
        if (mapping.data_type === 'bool') {
          boolCount++;
        } else if (mapping.data_type === 'channel') {
          channelCount++;
          // Count child bits as bool variables
          if (mapping.metadata?.bit_mappings) {
            boolCount += Object.keys(mapping.metadata.bit_mappings).length;
          }
        }
      });
    }

    const normalizedPLC: NormalizedPLC = {
      id: Math.random().toString(36).substr(2, 9), // Generate ID if not present
      plc_name: plc.plc_name,
      plc_no: plc.plc_no, // Include plc_no from the config
      plc_ip: plc.plc_ip,
      opcua_url: plc.opcua_url,
      status: "maintenance",
      last_checked: new Date(),
      is_connected: false,
      created_at: new Date(),
      variables: allVariables,
      registerCount: allVariables.length,
      boolCount,
      channelCount,
    };

    return normalizedPLC;
  });
}

/**
 * Group normalized PLCs by OPCUA server URL
 */
export function groupPLCsByServer(plcs: NormalizedPLC[]): ServerGroup[] {
  const grouped = new Map<string, NormalizedPLC[]>();
  
  plcs.forEach(plc => {
    const serverUrl = plc.opcua_url;
    if (!grouped.has(serverUrl)) {
      grouped.set(serverUrl, []);
    }
    grouped.get(serverUrl)!.push(plc);
  });
  
  return Array.from(grouped.entries()).map(([url, serverPlcs]) => ({
    serverUrl: url,
    plcs: serverPlcs,
    connectedCount: serverPlcs.filter(p => p.is_connected).length,
    totalCount: serverPlcs.length,
    status: serverPlcs.some(p => p.is_connected) ? "connected" : "disconnected",
    lastUpdated: Math.max(...serverPlcs.map(p => new Date(p.last_checked ?? 0).getTime())),
  }));
}

/**
 * Filter variables by search query
 */
export function filterVariables(
  variables: NormalizedVariable[], 
  searchQuery: string
): NormalizedVariable[] {
  if (!searchQuery.trim()) return variables;
  
  const query = searchQuery.toLowerCase();
  
  return variables.filter(variable => 
    variable.plc_reg_add.toLowerCase().includes(query) ||
    variable.opcua_reg_add.toLowerCase().includes(query) ||
    variable.description.toLowerCase().includes(query)
  );
}

/**
 * Get parent variables (channel types) for expandable table
 */
export function getParentVariables(variables: NormalizedVariable[]): NormalizedVariable[] {
  return variables.filter(v => !v.parentId);
}

/**
 * Get child variables for a specific parent
 */
export function getChildVariables(
  variables: NormalizedVariable[], 
  parentId: string
): NormalizedVariable[] {
  return variables.filter(v => v.parentId === parentId);
}

/**
 * Convert normalized PLC back to API-compatible format
 */
export function denormalizePLC(normalizedPLC: NormalizedPLC): RawPLCConfig {
  // Extract unique parent variables to reconstruct address_mappings
  const parentVariables = getParentVariables(normalizedPLC.variables);
  
  const address_mappings = parentVariables.map(variable => {
    const mapping: AddressMapping = {
      plc_reg_add: variable.plc_reg_add,
      data_type: variable.data_type,
      opcua_reg_add: variable.opcua_reg_add,
      description: variable.description,
    };

    // Add metadata for channel types
    if (variable.type === 'channel' && variable.hasChildren) {
      const children = getChildVariables(normalizedPLC.variables, variable.id);
      const bit_mappings: Record<string, BitMapping> = {};
      
      children.forEach((child, index) => {
        const bitKey = `bit_${(child.bitPosition ?? 0).toString().padStart(2, '0')}`;
        bit_mappings[bitKey] = {
          address: child.plc_reg_add,
          description: child.description,
          bit_position: child.bitPosition ?? 0,
        };
      });

      mapping.metadata = {
        bit_count: children.length,
        bit_mappings,
      };
    }

    return mapping;
  });

  const result: RawPLCConfig = {
    plc_name: normalizedPLC.plc_name,
    plc_no: normalizedPLC.plc_no || 1, // Default to 1 if not set
    plc_ip: normalizedPLC.plc_ip,
    opcua_url: normalizedPLC.opcua_url,
    address_mappings: address_mappings,
  };
  
  return result;
}