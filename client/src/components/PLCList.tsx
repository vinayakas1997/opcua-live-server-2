import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ArrowUpDown } from "lucide-react";
import PLCListItem from "./PLCListItem";
import type { PLC } from "@shared/schema";

interface PLCListProps {
  plcs: PLC[];
  onConnect?: (plcId: string) => void;
  onDisconnect?: (plcId: string) => void;
  onRefresh?: (plcId: string) => void;
  onConfigure?: (plcId: string) => void;
}

export default function PLCList({ 
  plcs, 
  onConnect, 
  onDisconnect, 
  onRefresh, 
  onConfigure 
}: PLCListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredAndSortedPLCs = useMemo(() => {
    let filtered = plcs.filter((plc) =>
      plc.plc_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (plc.plc_no?.toString() || '').includes(searchTerm) ||
      plc.plc_ip.includes(searchTerm)
    );

    return filtered.sort((a, b) => {
      const aNum = a.plc_no || 0;
      const bNum = b.plc_no || 0;
      const comparison = sortOrder === "asc"
        ? aNum - bNum
        : bNum - aNum;
      return comparison;
    });
  }, [plcs, searchTerm, sortOrder]);

  const toggleSort = () => {
    setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    console.log(`Sort order changed to: ${sortOrder === "asc" ? "desc" : "asc"}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search PLCs by name, number, or IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-plcs"
          />
        </div>
        
        <Button 
          variant="outline" 
          size="icon"
          onClick={toggleSort}
          data-testid="button-sort-plcs"
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        {filteredAndSortedPLCs.length} PLC{filteredAndSortedPLCs.length !== 1 ? 's' : ''} found
        {searchTerm && ` (filtered from ${plcs.length} total)`}
        {" • Sorted by PLC number "}({sortOrder === "asc" ? "ascending" : "descending"})
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-3" data-testid="list-plcs">
          {filteredAndSortedPLCs.map((plc) => (
            <PLCListItem
              key={plc.id}
              plc={plc}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onRefresh={onRefresh}
              onConfigure={onConfigure}
            />
          ))}
          
          {filteredAndSortedPLCs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="space-y-2">
                <p className="text-lg">No PLCs found</p>
                <p className="text-sm">
                  {searchTerm ? "Try adjusting your search terms" : "No PLCs have been configured yet"}
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}