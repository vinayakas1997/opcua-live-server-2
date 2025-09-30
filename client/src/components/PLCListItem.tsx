import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MoreVertical, Settings, RefreshCw, Wifi } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import StatusIndicator from "./StatusIndicator";
import type { PLC } from "@shared/schema";

interface PLCListItemProps {
  plc: PLC;
  onConnect?: (plcId: string) => void;
  onDisconnect?: (plcId: string) => void;
  onRefresh?: (plcId: string) => void;
  onConfigure?: (plcId: string) => void;
}

export default function PLCListItem({ 
  plc, 
  onConnect, 
  onDisconnect, 
  onRefresh, 
  onConfigure 
}: PLCListItemProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (plc.opcua_status === "connected") {
      console.log(`Disconnecting PLC ${plc.plc_name}`);
      onDisconnect?.(plc.id);
    } else {
      console.log(`Connecting PLC ${plc.plc_name}`);
      setIsConnecting(true);
      // Simulate connection delay
      setTimeout(() => {
        setIsConnecting(false);
        onConnect?.(plc.id);
      }, 1000);
    }
  };

  const handleRefresh = () => {
    console.log(`Refreshing PLC ${plc.plc_name}`);
    onRefresh?.(plc.id);
  };

  const handleConfigure = () => {
    console.log(`Configuring PLC ${plc.plc_name}`);
    onConfigure?.(plc.id);
  };

  const truncatedName = plc.plc_name.length > 25 
    ? `${plc.plc_name.substring(0, 25)}...` 
    : plc.plc_name;

  return (
    <Card className="p-4 hover-elevate" data-testid={`card-plc-${plc.id}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <StatusIndicator status={plc.opcua_status} />
          
          <div className="flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1">
                  <p className="font-mono text-sm font-medium text-foreground">
                    {`P_${plc.plc_no}_${truncatedName}`}
                  </p>
                  <p 
                    className={`text-xs font-mono px-2 py-1 rounded text-plc-ip ${
                      (plc as any).plc_status === 'connected' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}
                  >
                    PLC: {plc.plc_ip}
                  </p>
                </div>
              </TooltipTrigger>
              {plc.plc_name.length > 25 && (
                <TooltipContent>
                  <p className="font-mono">{`P_${plc.plc_no}_${plc.plc_name}`}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={plc.opcua_status === "connected" ? "default" : "secondary"}>
              <Wifi className="w-3 h-3 mr-1" />
              {plc.opcua_status === "connected" ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleConnect}
            disabled={isConnecting}
            data-testid={`button-connect-${plc.id}`}
          >
            {isConnecting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : plc.opcua_status === "connected" ? (
              "Disconnect"
            ) : (
              "Connect"
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-menu-${plc.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRefresh} data-testid={`menu-refresh-${plc.id}`}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleConfigure} data-testid={`menu-configure-${plc.id}`}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t">
        <div className="flex items-center justify-between text-xs">
          <span 
            className={`font-mono px-2 py-1 rounded text-opcua-url ${
              (plc as any).opcua_status === 'connected' 
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
            }`}
          >
            OPC UA: {plc.opcua_url}
          </span>
          <span className="text-muted-foreground">
            Last checked: {plc.last_checked.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </Card>
  );
}
