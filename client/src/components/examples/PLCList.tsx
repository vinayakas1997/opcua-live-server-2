import PLCList from "../PLCList";
import { mockPLCs } from "@shared/schema";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function PLCListExample() {
  return (
    <TooltipProvider>
      <div className="p-4 max-w-4xl">
        <PLCList
          plcs={mockPLCs}
          onConnect={(id) => console.log(`Connect PLC ${id}`)}
          onDisconnect={(id) => console.log(`Disconnect PLC ${id}`)}
          onRefresh={(id) => console.log(`Refresh PLC ${id}`)}
          onConfigure={(id) => console.log(`Configure PLC ${id}`)}
        />
      </div>
    </TooltipProvider>
  );
}