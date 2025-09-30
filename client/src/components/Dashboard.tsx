import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import EnhancedVariablesTable from "./EnhancedVariablesTable";
import LiveDataTable from "./LiveDataTable";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { type PLC } from "@shared/schema";
import { type NormalizedPLC, type NormalizedVariable } from "@shared/normalization";

export default function Dashboard() {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  // State for error tracking and last update time
  const [hasError, setHasError] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date().toLocaleTimeString());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Parse plcId from query parameters
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const selectedPlcId = searchParams.get('plcId');

  // Fetch PLCs with mappings (same as AppLayout)
  const { data: plcs = [], isLoading, refetch } = useQuery({
    queryKey: ['api', 'plcs', 'withMappings'],
    queryFn: api.getAllPLCsWithMappings,
    staleTime: 0,
    gcTime: 0,
  });

  // Auto-refresh PLCs status every 30 seconds
  const { data: plcsStatus = [], isLoading: isStatusLoading, error: statusError } = useQuery({
    queryKey: ['api', 'plcs', 'all-status'],
    queryFn: api.getAllPLCsStatus,
    refetchInterval: 30000, // 30 seconds
    staleTime: 25000, // Consider data stale after 25 seconds
    gcTime: 60000, // Keep in cache for 1 minute
  });

  // Handle status updates with useEffect
  useEffect(() => {
    if (statusError) {
      console.error('Status update failed:', statusError);
      setHasError(true);
      setLastUpdateTime(new Date().toLocaleTimeString());
      setIsRefreshing(false);
    } else if (plcsStatus.length > 0) {
      setHasError(false);
      setLastUpdateTime(new Date().toLocaleTimeString());
      setIsRefreshing(false);
    }
  }, [plcsStatus, statusError]);

  // Track when refresh starts
  useEffect(() => {
    if (isStatusLoading) {
      setIsRefreshing(true);
    }
  }, [isStatusLoading]);

  // Refetch when selectedPlcId changes to ensure fresh data
  useEffect(() => {
    console.log('Dashboard: selectedPlcId changed to:', selectedPlcId);
    if (selectedPlcId) {
      refetch();
    }
  }, [selectedPlcId, refetch]);

  // Create a map of PLC status for quick lookup
  const statusMap = new Map(plcsStatus.map(status => [status.plc_id, status]));

  // Merge PLCs with their current status
  const plcsWithStatus = plcs.map(plc => {
    const status = statusMap.get(plc.id);
    return {
      ...plc,
      is_connected: status?.is_connected ?? plc.is_connected,
      status: (status?.status === 'active' || status?.status === 'error' || status?.status === 'maintenance') 
        ? status.status as "active" | "error" | "maintenance"
        : plc.status,
      last_checked: status ? new Date(status.last_checked) : plc.last_checked,
    };
  });

  const connectedPLCs = plcsWithStatus.filter(plc => plc.is_connected);

  // Select PLC: either from URL param or first available PLC
  const selectedPLC = selectedPlcId
    ? plcsWithStatus.find(p => p.id === selectedPlcId)
    : plcsWithStatus.length > 0 ? plcsWithStatus[0] : null;

  // Get status for selected PLC
  const selectedPLCStatus = selectedPLC ? statusMap.get(selectedPLC.id) : null;

  // Check if OPCUA URL has any connected PLCs
  const getOpcuaUrlStatus = (opcuaUrl: string) => {
    return plcsWithStatus
      .filter(plc => plc.opcua_url === opcuaUrl)
      .some(plc => plc.is_connected);
  };

  console.log('Dashboard: plcs length:', plcs.length);
  console.log('Dashboard: selectedPlcId:', selectedPlcId);
  console.log('Dashboard: selectedPLC:', selectedPLC);

  // Convert regular PLC to NormalizedPLC using actual data from uploaded config
  const createNormalizedPLCFromConfig = (plc: PLC): NormalizedPLC => {
    // If PLC has address_mappings, use them to create variables
    const variables: NormalizedVariable[] = [];
    
    if (plc.address_mappings && plc.address_mappings.length > 0) {
      plc.address_mappings.forEach((mapping, index) => {
        // Create variable from address mapping
        const variable: NormalizedVariable = {
          id: mapping.node_id || `${plc.id}_var_${index}`,
          type: mapping.data_type === 'channel' ? 'channel' : 'bool',
          plc_reg_add: mapping.node_id, // Use node_id (reg_address from database) as PLC register address
          opcua_reg_add: mapping.node_name, // Use node_name as OPC UA register
          description: mapping.description || 'No description',
          data_type: mapping.data_type || 'unknown',
        };

        // Check if this is a Boolean Channel (_BC) variable
        if (mapping.node_name.endsWith('_BC')) {
          variable.type = 'channel';
          variable.hasChildren = true;
          
          // Create mock bit mappings for BC variables (in real implementation, this would come from metadata)
          const bitCount = 8; // Default bit count for BC variables
          const bitVariables: NormalizedVariable[] = [];
          
          for (let bit = 0; bit < bitCount; bit++) {
            const bitNumber = bit.toString().padStart(2, '0');
            const bitVariable: NormalizedVariable = {
              id: `${variable.id}_bit_${bitNumber}`,
              type: 'bool',
              plc_reg_add: `${mapping.node_id.replace('_BC', '')}.${bitNumber}`,
              opcua_reg_add: mapping.node_name.replace('_BC', `_BC_${bitNumber}`),
              description: `Bit ${bitNumber} of ${mapping.description || mapping.node_name}`,
              data_type: 'bool',
              parentId: variable.id,
              bitPosition: bit,
            };
            bitVariables.push(bitVariable);
          }
          
          variables.push(variable, ...bitVariables);
        } else {
          variables.push(variable);
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
      status: plc.status,
      last_checked: plc.last_checked,
      is_connected: plc.is_connected,
      created_at: plc.created_at,
      variables: variables,
      registerCount: variables.length,
      boolCount: variables.filter(v => v.type === 'bool').length,
      channelCount: variables.filter(v => v.type === 'channel').length,
    };
  };

  const normalizedSelectedPLC = selectedPLC ? createNormalizedPLCFromConfig(selectedPLC) : null;

  // CSV Export function
  const handleExportCSV = () => {
    if (!normalizedSelectedPLC || !normalizedSelectedPLC.variables.length) {
      toast({
        title: "No Data",
        description: "No variables available to export",
        variant: "destructive",
      });
      return;
    }

    // Create CSV headers
    const headers = [
      "Node Name",
      "Description",
      "Value",
      "Timestamp",
      "Address",
      "Data Type",
      "User Description"
    ];

    // Create CSV rows
    const rows = normalizedSelectedPLC.variables.map((variable) => [
      variable.opcua_reg_add || "",
      variable.description || "",
      variable.type === "bool" ? "false" : variable.type === "channel" ? "N/A" : "N/A",
      new Date().toLocaleTimeString('en-GB', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      variable.plc_reg_add || "",
      variable.type || "",
      "" // User description would be empty for export
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(","))
      .join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${normalizedSelectedPLC.plc_name}_variables_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Exported ${normalizedSelectedPLC.variables.length} variables to CSV`,
      variant: "success",
    });
  };

  // Manual refresh function for PLC click
  const handleManualRefresh = () => {
    setIsRefreshing(true);
    queryClient.invalidateQueries({ queryKey: ['api', 'plcs', 'all-status'] });
    queryClient.invalidateQueries({ queryKey: ['api', 'plcs', 'withMappings'] });
  };

  // Debug logging for PLC data
  console.log('=== Dashboard Debug ===');
  console.log('selectedPLC:', selectedPLC);
  console.log('selectedPLC address_mappings:', selectedPLC?.address_mappings);
  console.log('normalizedSelectedPLC:', normalizedSelectedPLC);
  console.log('normalizedSelectedPLC variables:', normalizedSelectedPLC?.variables);
  console.log('normalizedSelectedPLC variables count:', normalizedSelectedPLC?.variables?.length);

  return (
    <div className="h-full flex flex-col">
      {selectedPLC && (
        <div className="p-6 border-b bg-muted/50">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="text-plc-name">
              {selectedPLC.plc_name}
              {hasError && (
                <span className="text-red-500 text-sm font-normal">
                  auto update is failing..
                </span>
              )}
            </h2>
            <div className="flex items-center gap-6 text-sm">
              <span 
                className={`px-3 py-2 rounded-lg shadow-lg border-2 font-medium ${
                  selectedPLC.is_connected && selectedPLC.status !== 'error'
                    ? 'bg-gradient-to-br from-green-500 to-green-600 text-white border-green-400' 
                    : 'bg-gradient-to-br from-red-500 to-red-600 text-white border-red-400'
                }`}
                data-testid="text-plc-ip"
              >
                <strong>IP:</strong> {selectedPLC.plc_ip}
              </span>
              <span 
                className={`px-3 py-2 rounded-lg shadow-lg border-2 font-medium ${
                  getOpcuaUrlStatus(selectedPLC.opcua_url)
                    ? 'bg-gradient-to-br from-green-500 to-green-600 text-white border-green-400' 
                    : 'bg-gradient-to-br from-red-500 to-red-600 text-white border-red-400'
                }`}
                data-testid="text-opcua-url"
              >
                <strong>OPCUA URL:</strong> {selectedPLC.opcua_url}
              </span>
              <span data-testid="text-register-count" className="text-muted-foreground">
                <strong>Registers:</strong> {normalizedSelectedPLC?.registerCount || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">
            {selectedPLC ? `${selectedPLC.plc_name} Variables` : "OPC UA Dashboard"}
          </h1>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-4">
              <Button
                variant="default"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                data-testid="button-export-csv"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                <div className={`w-2 h-2 rounded-full ${connectedPLCs.length > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium" data-testid="text-plcs-connected">
                  {connectedPLCs.length}/{plcsWithStatus.length} PLCs Connected
                </span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                hasError 
                  ? 'bg-red-500/20 border-2 border-red-400' 
                  : 'bg-muted'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isRefreshing 
                    ? 'bg-blue-500 animate-spin' 
                    : hasError 
                      ? 'bg-red-500' 
                      : 'bg-blue-500 animate-pulse'
                }`}>
                  {isRefreshing && <Loader2 className="w-2 h-2" />}
                </div>
                <span className={`text-sm font-medium ${
                  hasError ? 'text-red-400' : ''
                }`} data-testid="text-last-updated">
                  Last Updated: {lastUpdateTime}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col gap-6">
          {connectedPLCs.length > 0 || selectedPLC ? (
            <>
              <EnhancedVariablesTable
                plc={normalizedSelectedPLC || null}
                onRefresh={() => {
                  handleManualRefresh();
                  toast({
                    title: t("success"),
                    description: t("dataRefreshed"),
                    variant: "success",
                  });
                }}
              />
              <LiveDataTable
                plc={selectedPLC || null}
                onRefresh={() => {
                  handleManualRefresh();
                  toast({
                    title: t("success"),
                    description: t("dataRefreshed"),
                    variant: "success",
                  });
                }}
              />
            </>
          ) : (
          <div className="text-center py-24 text-muted-foreground">
            <div className="space-y-4">
              <h3 className="text-xl font-medium">
                {isLoading ? "Loading PLCs..." : plcs.length === 0 ? "No PLCs Available" : "No PLCs Connected"}
              </h3>
              <p className="text-sm max-w-md mx-auto">
                {isLoading ? "Please wait while we load your PLC configurations..." :
                 plcs.length === 0 ? "Add new PLC configurations using the \"Add New\" button to get started." :
                 "Connect to one or more PLCs from the sidebar to start monitoring live data."}
              </p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
