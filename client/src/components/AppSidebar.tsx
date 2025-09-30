import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Search,
  Wifi,
  WifiOff,
  ArrowUpDown,
  Trash2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import StatusIndicator from "./StatusIndicator";
import { api } from "@/lib/api";
import type { PLC } from "@shared/schema";

interface AppSidebarProps {
  plcs: PLC[];
  isLoading?: boolean;
  selectedPLCs: Set<string>;
  selectedPlcId: string | null;
  onSelectPlc: (plcId: string) => void;
  onConnect: (plcId: string) => void;
  onDisconnect: (plcId: string) => void;
  onCheckStatus: (plcId: string) => void;
  onRefresh: (plcId: string) => void;
  onConfigure: (plcId: string) => void;
  onDelete: (plcId: string) => void;
}

export function AppSidebar({
  plcs,
  isLoading = false,
  selectedPLCs,
  selectedPlcId,
  onSelectPlc,
  onConnect,
  onDisconnect,
  onCheckStatus,
  onRefresh,
  onConfigure,
  onDelete
}: AppSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [, navigate] = useLocation();

  // Get real-time status updates (same as Dashboard)
  const { data: plcsStatus = [] } = useQuery({
    queryKey: ['api', 'plcs', 'all-status'],
    queryFn: api.getAllPLCsStatus,
    refetchInterval: 30000, // 30 seconds
    staleTime: 25000,
    gcTime: 60000,
  });

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

  const filteredAndSortedPLCs = plcsWithStatus
    .filter(plc => 
      plc.plc_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (plc.plc_no?.toString() || '').includes(searchTerm) ||
      plc.plc_ip.includes(searchTerm)
    )
    .sort((a, b) => {
      const aNum = a.plc_no || 0;
      const bNum = b.plc_no || 0;
      const comparison = sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      return comparison;
    });

  const connectedCount = plcsWithStatus.filter(plc => plc.is_connected).length;
  const activeCount = plcsWithStatus.filter(plc => plc.status === "active").length;
  const errorCount = plcsWithStatus.filter(plc => plc.status === "error").length;

  const handlePLCClick = (plc: PLC) => {
    // Print the PLC number to console
    console.log('AppSidebar: handlePLCClick called for PLC:', plc.id, plc.plc_name);

    // Select the PLC when clicked
    console.log('AppSidebar: calling onSelectPlc with:', plc.id);
    onSelectPlc(plc.id);

    // Call connect to trigger backend /connect endpoint
    console.log('AppSidebar: calling onConnect with:', plc.id);
    onConnect(plc.id);
  };

  const handleWifiClick = (plc: PLC, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('AppSidebar: wifi click for PLC:', plc.id);
    
    if (selectedPLCs.has(plc.id)) {
      onDisconnect(plc.id);
    } else {
      onConnect(plc.id);
    }
  };

  const truncateName = (name: string) => {
    return name.length > 16 ? `${name.substring(0, 16)}...` : name;
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">PLC Monitor</span>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center p-2 rounded-md bg-card">
              <div className="font-mono font-semibold text-green-600">{connectedCount}</div>
              <div className="text-muted-foreground">Connected</div>
            </div>
            <div className="text-center p-2 rounded-md bg-card">
              <div className="font-mono font-semibold text-blue-600">{activeCount}</div>
              <div className="text-muted-foreground">Active</div>
            </div>
            <div className="text-center p-2 rounded-md bg-card">
              <div className="font-mono font-semibold text-red-600">{errorCount}</div>
              <div className="text-muted-foreground">Errors</div>
            </div>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>PLCs ({filteredAndSortedPLCs.length})</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
              data-testid="button-sort-sidebar"
            >
              <ArrowUpDown className="h-3 w-3" />
            </Button>
          </SidebarGroupLabel>
          
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 h-8 text-xs"
                data-testid="input-search-sidebar"
              />
            </div>
          </div>
          
          <SidebarGroupContent>
            <ScrollArea className="h-[calc(100vh-280px)]">
              <SidebarMenu>
                {filteredAndSortedPLCs.map((plc) => {
                  const isConnected = selectedPLCs.has(plc.id);
                  const displayName = `P_${plc.plc_no}_${truncateName(plc.plc_name)}`;
                  const fullName = `P_${plc.plc_no}_${plc.plc_name}`;
                  
                  return (
                    <SidebarMenuItem key={plc.id}>
                      <SidebarMenuButton
                        className={`w-full justify-between p-3 h-auto ${
                          isConnected ? 'bg-sidebar-accent' : ''
                        }`}
                        onClick={() => handlePLCClick(plc)}
                        data-testid={`sidebar-plc-${plc.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <StatusIndicator status={plc.status} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs font-medium truncate">
                              {displayName}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {plc.plc_ip}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={(e) => handleWifiClick(plc, e)}
                            data-testid={`button-connect-inline-${plc.id}`}
                          >
                            {plc.status === 'active' ? (
                              <Wifi className="h-3 w-3 text-green-600" />
                            ) : plc.status === 'maintenance' ? (
                              <Wifi className="h-3 w-3 text-yellow-600" />
                            ) : plc.status === 'error' ? (
                              <WifiOff className="h-3 w-3 text-red-600" />
                            ) : (
                              <WifiOff className="h-3 w-3 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(plc.id);
                            }}
                            data-testid={`button-delete-inline-${plc.id}`}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
              
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-xs">Loading PLCs...</p>
                </div>
              ) : filteredAndSortedPLCs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-xs">No PLCs found</p>
                  <p className="text-xs mt-1">
                    {searchTerm ? "Try different search terms" : "Add new PLCs to get started"}
                  </p>
                </div>
              ) : null}
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
