import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Plus, LayoutDashboard, Server, RefreshCw, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppSidebar } from "./AppSidebar";
import LanguageSwitcher from "./LanguageSwitcher";
import JsonUploader from "./JsonUploader";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/api";
import { socketManager } from "@/lib/socket";
import { useToast } from "@/hooks/use-toast";
import { type PLCConfig, type PLC, type NodeData } from "@shared/schema";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [selectedPLCs, setSelectedPLCs] = useState<Set<string>>(new Set());
  const [selectedPlcId, setSelectedPlcId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [nodeData, setNodeData] = useState<NodeData[]>([]);

  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Get current page from route
  const currentPage = location === '/servers' ? 'servers' : 'dashboard';

  // Initialize selectedPlcId from URL params
  useEffect(() => {
    const searchParams = new URLSearchParams(location.split('?')[1] || '');
    const plcId = searchParams.get('plcId');
    if (plcId && plcId !== selectedPlcId) {
      setSelectedPlcId(plcId);
    }
  }, [location, selectedPlcId]);

  // Fetch PLCs with mappings for dashboard
  const { data: plcs = [], isLoading, error } = useQuery<PLC[]>({
    queryKey: ['api', 'plcs', 'withMappings'],
    queryFn: () => api.getAllPLCsWithMappings(),
  });

  // Initialize selectedPlcId to first PLC if none selected
  useEffect(() => {
    if (plcs.length > 0 && !selectedPlcId) {
      setSelectedPlcId(plcs[0].id);
      navigate(`/?plcId=${plcs[0].id}`);
    }
  }, [plcs, selectedPlcId, navigate]);

  // Connect PLC mutation
  const connectMutation = useMutation({
    mutationFn: api.connectPLC,
    onSuccess: (updatedPLC) => {
      queryClient.invalidateQueries({ queryKey: ['api', 'plcs'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'plcs', 'withMappings'] });
      setSelectedPLCs(prev => new Set(Array.from(prev).concat(updatedPLC.id)));
      socketManager.subscribeToPLC(updatedPLC.id);
      toast({
        title: t("serverConnected"),
        description: `${t("success")}: ${updatedPLC.plc_name}`,
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: t("connectionFailed"),
        description: error.message,
        variant: "error",
      });
    },
  });

  // Disconnect PLC mutation
  const disconnectMutation = useMutation({
    mutationFn: api.disconnectPLC,
    onSuccess: (updatedPLC) => {
      queryClient.invalidateQueries({ queryKey: ['api', 'plcs'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'plcs', 'withMappings'] });
      setSelectedPLCs(prev => {
        const newSet = new Set(prev);
        newSet.delete(updatedPLC.id);
        return newSet;
      });
      socketManager.unsubscribeFromPLC(updatedPLC.id);
      toast({
        title: t("serverDisconnected"),
        description: `${t("disconnected")}: ${updatedPLC.plc_name}`,
        variant: "warning",
      });
    },
    onError: (error) => {
      toast({
        title: t("connectionFailed"),
        description: error.message,
        variant: "error",
      });
    },
  });

  // Update PLC status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ plcId, status }: { plcId: string; status: import("@shared/schema").PLCStatus }) =>
      api.updatePLC(plcId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'plcs'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'plcs', 'withMappings'] });
      toast({
        title: "Status Updated",
        description: "PLC status updated successfully",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "error",
      });
    },
  });

  // Create PLC mutation
  const createMutation = useMutation({
    mutationFn: api.createPLC,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'plcs'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'plcs', 'withMappings'] });
      toast({
        title: t("plcAdded"),
        description: t("plcAddedSuccess"),
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: t("plcAddFailed"),
        description: error.message,
        variant: "error",
      });
    },
  });

  // Delete PLC mutation
  const deleteMutation = useMutation({
    mutationFn: api.deletePLC,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api', 'plcs'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'plcs', 'withMappings'] });
      toast({
        title: t("plcDeleted"),
        description: t("plcDeletedSuccess"),
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: t("plcDeleteFailed"),
        description: error.message,
        variant: "error",
      });
    },
  });

  // WebSocket connection
  useEffect(() => {
    const socket = socketManager.connect();

    socket.on("nodeDataUpdate", (data: NodeData[]) => {
      setNodeData(data);
    });

    socket.on("plcs", (data: PLC[]) => {
      queryClient.setQueryData(['api', 'plcs'], data);
    });

    return () => {
      socketManager.disconnect();
    };
  }, [queryClient]);

  const handleConfigUploaded = (config: PLCConfig) => {
    createMutation.mutate(config);
    setIsUploadDialogOpen(false);
  };

  const handleConnectPLC = (plcId: string) => {
    connectMutation.mutate(plcId);
  };

  const handleDisconnectPLC = (plcId: string) => {
    disconnectMutation.mutate(plcId);
  };

  const handleToggleStatus = (plc: PLC) => {
    const newStatus = plc.status === 'active' ? 'maintenance' : plc.status === 'maintenance' ? 'active' : plc.status;
    updateStatusMutation.mutate({ plcId: plc.id, status: newStatus });
  };

  const handleDeletePLC = (plcId: string) => {
    // Also disconnect if currently connected
    if (selectedPLCs.has(plcId)) {
      setSelectedPLCs(prev => {
        const newSet = new Set(prev);
        newSet.delete(plcId);
        return newSet;
      });
      socketManager.unsubscribeFromPLC(plcId);
    }
    // If deleting the currently selected PLC, select another one
    if (selectedPlcId === plcId) {
      const remainingPLCs = plcs.filter(p => p.id !== plcId);
      setSelectedPlcId(remainingPLCs.length > 0 ? remainingPLCs[0].id : null);
    }
    deleteMutation.mutate(plcId);
  };

  const handleSelectPlc = (plcId: string) => {
    console.log('AppLayout: handleSelectPlc called with:', plcId);
    setSelectedPlcId(plcId);
    navigate(`/?plcId=${plcId}`);
  };

  // Custom sidebar width for better content layout
  const style = {
    "--sidebar-width": "20rem",       // 320px for better content
    "--sidebar-width-icon": "4rem",   // default icon width
  } as React.CSSProperties;

  const handleTabChange = (value: string) => {
    if (value === 'servers') {
      navigate('/servers');
    } else {
      navigate('/');
    }
  };

  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full">
        <AppSidebar
          plcs={plcs}
          isLoading={isLoading}
          selectedPLCs={selectedPLCs}
          selectedPlcId={selectedPlcId}
          onSelectPlc={handleSelectPlc}
          onConnect={handleConnectPLC}
          onDisconnect={handleDisconnectPLC}
          onRefresh={(id) => console.log(`Refresh PLC ${id}`)}
          onConfigure={(id) => console.log(`Configure PLC ${id}`)}
          onDelete={handleDeletePLC}
        />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-new">
                    <Plus className="w-4 h-4 mr-2" />
                    {t("addNew")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{t("uploadJsonConfig")}</DialogTitle>
                  </DialogHeader>
                  <JsonUploader
                    onConfigUploaded={handleConfigUploaded}
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ['api', 'plcs'] })}
                    onClose={() => setIsUploadDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
              
              <Tabs value={currentPage} onValueChange={handleTabChange}>
                <TabsList data-testid="tabs-navigation">
                  <TabsTrigger value="dashboard" data-testid="tab-dashboard">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    {t("dashboard")}
                  </TabsTrigger>
                  <TabsTrigger value="servers" data-testid="tab-servers">
                    <Server className="w-4 h-4 mr-2" />
                    {t("opcuaServers")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['api', 'plcs'] });
                  toast({
                    title: t("refreshing"),
                    description: t("dataRefreshed"),
                    variant: "success",
                  });
                }}
                data-testid="button-refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="button-menu">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsUploadDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("addNew")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => queryClient.invalidateQueries()}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t("refreshAll")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <LanguageSwitcher />
            </div>
          </header>

          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}