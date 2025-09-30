import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Server, Activity } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PLC } from "@shared/schema";

// Group PLCs by OPCUA URL
const groupPLCsByServer = (plcs: PLC[]) => {
  const grouped = new Map<string, PLC[]>();
  
  plcs.forEach(plc => {
    const serverUrl = plc.opcua_url;
    if (!grouped.has(serverUrl)) {
      grouped.set(serverUrl, []);
    }
    grouped.get(serverUrl)!.push(plc);
  });
  
  return Array.from(grouped.entries()).map(([url, plcs]) => ({
    serverUrl: url,
    plcs,
    connectedCount: plcs.filter(p => p.plc_status === 'connected').length,
    totalCount: plcs.length,
    status: plcs.some(p => p.plc_status === 'connected') ? "connected" : "disconnected",
    lastUpdated: Math.max(...plcs.map(p => new Date(p.last_checked ?? 0).getTime())),
  }));
};

export default function ServersPage() {
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  
  const { data: plcs = [], isLoading, error } = useQuery<PLC[]>({
    queryKey: ['api', 'plcs', 'withMappings'],
    queryFn: () => api.getAllPLCsWithMappings(),
    staleTime: 0,
    gcTime: 0,
  });

  console.log('ServersPage: query error:', error);

  console.log('ServersPage: plcs data:', plcs);
  console.log('ServersPage: plcs length:', plcs.length);

  const servers = groupPLCsByServer(plcs);
  console.log('ServersPage: servers:', servers);
  console.log('ServersPage: servers length:', servers.length);
  const connectedServers = servers.filter(s => s.status === "connected").length;

  const toggleServerExpansion = (serverUrl: string) => {
    setExpandedServers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serverUrl)) {
        newSet.delete(serverUrl);
      } else {
        newSet.add(serverUrl);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    const variant = status === "connected" ? "default" : "secondary";
    const icon = status === "connected" ? Activity : Server;
    const Icon = icon;
    
    return (
      <Badge variant={variant} className="flex items-center gap-1" data-testid={`status-${status}`}>
        <Icon className="w-3 h-3" />
        {status === "connected" ? "Connected" : "Disconnected"}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" data-testid="text-servers-title">OPCUA Servers</h1>
          <div className="text-sm text-muted-foreground" data-testid="text-servers-count">
            Loading servers...
          </div>
        </div>
        <div className="text-center py-24 text-muted-foreground">
          <p>Loading server configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-servers-title">OPCUA Servers</h1>
        <div className="text-sm text-muted-foreground" data-testid="text-servers-count">
          {connectedServers}/{servers.length} servers connected
        </div>
      </div>

      {servers.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <div className="space-y-4">
            <h3 className="text-xl font-medium">No Servers Available</h3>
            <p className="text-sm max-w-md mx-auto">
              Add PLC configurations to see grouped servers here.
            </p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead data-testid="header-server-url">Server URL</TableHead>
                <TableHead data-testid="header-status">Status</TableHead>
                <TableHead data-testid="header-updated">Last Updated</TableHead>
                <TableHead data-testid="header-plc-count">PLCs Connected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servers.map((server) => {
                const isExpanded = expandedServers.has(server.serverUrl);
                
                return (
                  <Collapsible key={server.serverUrl} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow 
                          className="cursor-pointer hover-elevate h-4"
                          onClick={() => toggleServerExpansion(server.serverUrl)}
                          data-testid={`row-server-${server.serverUrl}`}
                        >
                          <TableCell>
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium" data-testid={`text-server-url-${server.serverUrl}`}>
                            {server.serverUrl}
                          </TableCell>
                          <TableCell data-testid={`status-server-${server.serverUrl}`}>
                            {getStatusBadge(server.status)}
                          </TableCell>
                          <TableCell data-testid={`text-updated-${server.serverUrl}`}>
                            {server.lastUpdated ? new Date(server.lastUpdated).toLocaleString() : "Never"}
                          </TableCell>
                          <TableCell data-testid={`text-plc-count-${server.serverUrl}`}>
                            {server.connectedCount}/{server.totalCount}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell></TableCell>
                          <TableCell colSpan={4}>
                            <div className="py-2 space-y-2">
                              <h4 className="font-medium text-sm text-muted-foreground mb-3">
                                PLCs on this server:
                              </h4>
                              <div className="grid gap-2">
                                {server.plcs.map((plc) => (
                                  <Link
                                    key={plc.id}
                                    href={`/?plcId=${plc.id}`}
                                    data-testid={`link-plc-${plc.id}`}
                                  >
                                    <div className="flex items-center justify-between p-3 border rounded hover-elevate min-h-12">
                                      <div className="flex items-center gap-3">
                                        <div>
                                          <div className="font-medium" data-testid={`text-plc-name-${plc.id}`}>
                                            {plc.plc_name}
                                          </div>
                                          <div className="text-sm text-muted-foreground" data-testid={`text-plc-ip-${plc.id}`}>
                                            {plc.plc_ip}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {getStatusBadge(plc.plc_status === 'connected' ? "connected" : "disconnected")}
                                      </div>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}