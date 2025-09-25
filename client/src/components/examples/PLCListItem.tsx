import PLCListItem from "../PLCListItem";
import { mockPLCs } from "@shared/schema";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function PLCListItemExample() {
  return (
    <TooltipProvider>
      <div className="p-4 space-y-4 max-w-2xl">
        {mockPLCs.slice(0, 3).map((plc) => (
          <PLCListItem
            key={plc.id}
            plc={plc}
            onConnect={(id) => console.log(`Connect PLC ${id}`)}
            onDisconnect={(id) => console.log(`Disconnect PLC ${id}`)}
            onRefresh={(id) => console.log(`Refresh PLC ${id}`)}
            onConfigure={(id) => console.log(`Configure PLC ${id}`)}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}