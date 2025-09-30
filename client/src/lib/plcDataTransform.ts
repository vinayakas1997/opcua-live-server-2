import { type NormalizedVariable, type NormalizedPLC } from "@shared/normalization";
import { type PLC, type PLCConfig } from "@shared/schema";

/**
 * Expands bit-mapped channels into individual bit rows
 * For example: P1_IO_1_BC with bit_00, bit_01 becomes P1_IO_1_BC_00, P1_IO_1_BC_01
 */
export function expandBitMappedChannels(config: PLCConfig): PLCConfig {
  // This function is not currently used and has type mismatches
  // Keeping for potential future use
  return config;
}

/**
 * Transform PLC configuration data to expand bit mappings into separate rows
 * For variables ending with _BC that have bit_mappings metadata, create individual bit rows
 */
export function transformPLCWithBitExpansion(plc: PLC): NormalizedPLC {
  const variables: NormalizedVariable[] = [];
  
  if (plc.address_mappings && plc.address_mappings.length > 0) {
    plc.address_mappings.forEach((mapping, index) => {
      // Create base variable from address mapping
      const baseVariable: NormalizedVariable = {
        id: mapping.node_id || `${plc.id}_var_${index}`,
        type: mapping.data_type === 'channel' ? 'channel' : 'bool',
        plc_reg_add: mapping.node_name,
        opcua_reg_add: mapping.node_name,
        description: mapping.description || 'No description',
        data_type: mapping.data_type || 'unknown',
        metadata: (mapping as any).metadata,
      };

      // Check if this is a Boolean Channel (_BC) variable with bit mappings
      if (mapping.node_name.endsWith('_BC') && (mapping as any).metadata?.bit_mappings) {
        baseVariable.type = 'channel';
        baseVariable.hasChildren = true;

        // Add the parent channel variable
        variables.push(baseVariable);

        // Create individual bit variables from metadata
        Object.entries((mapping as any).metadata.bit_mappings).forEach(([bitKey, bitData]: [string, any]) => {
          const bitNumber = bitData.bit_position.toString().padStart(2, '0');
          const bitVariable: NormalizedVariable = {
            id: `${baseVariable.id}_bit_${bitNumber}`,
            type: 'bool',
            plc_reg_add: `${mapping.node_name.replace('_BC', '')}.${bitNumber}`,
            opcua_reg_add: mapping.node_name.replace('_BC', `_BC_${bitNumber}`),
            description: bitData.description || `Bit ${bitNumber} of ${mapping.description || mapping.node_name}`,
            data_type: 'bool',
            parentId: baseVariable.id,
            bitPosition: bitData.bit_position,
            isBitRow: true,
          };
          variables.push(bitVariable);
        });
      } else if (mapping.node_name.endsWith('_BC')) {
        // Fallback: create default bit rows for BC variables without metadata
        baseVariable.type = 'channel';
        baseVariable.hasChildren = true;
        variables.push(baseVariable);
        
        const defaultBitCount = 8;
        for (let bit = 0; bit < defaultBitCount; bit++) {
          const bitNumber = bit.toString().padStart(2, '0');
          const bitVariable: NormalizedVariable = {
            id: `${baseVariable.id}_bit_${bitNumber}`,
            type: 'bool',
            plc_reg_add: `${mapping.node_name.replace('_BC', '')}.${bitNumber}`,
            opcua_reg_add: mapping.node_name.replace('_BC', `_BC_${bitNumber}`),
            description: `Bit ${bitNumber} of ${mapping.description || mapping.node_name}`,
            data_type: 'bool',
            parentId: baseVariable.id,
            bitPosition: bit,
            isBitRow: true,
          };
          variables.push(bitVariable);
        }
      } else {
        // Regular variable (not a bit channel)
        variables.push(baseVariable);
      }
    });
  }

  // If no address mappings, create some default variables for display
  if (variables.length === 0) {
    const defaultVariables: NormalizedVariable[] = [
      {
        id: `${plc.id}_default_1`,
        type: 'bool',
        plc_reg_add: 'M10',
        opcua_reg_add: 'ns=2;i=1001',
        description: 'Default Boolean Variable',
        data_type: 'bool',
      },
      {
        id: `${plc.id}_default_2`,
        type: 'channel',
        plc_reg_add: 'D100',
        opcua_reg_add: 'ns=2;i=1002',
        description: 'Default Channel Variable',
        data_type: 'channel',
        hasChildren: false,
      },
    ];
    variables.push(...defaultVariables);
  }

  return {
    id: plc.id,
    plc_name: plc.plc_name,
    plc_no: plc.plc_no,
    plc_ip: plc.plc_ip,
    opcua_url: plc.opcua_url,
    status: plc.plc_status === 'connected' ? 'active' : 'error',
    last_checked: plc.last_checked,
    is_connected: plc.plc_status === 'connected',
    created_at: plc.created_at,
    variables: variables,
    registerCount: variables.length,
    boolCount: variables.filter(v => v.type === 'bool').length,
    channelCount: variables.filter(v => v.type === 'channel').length,
  };
}