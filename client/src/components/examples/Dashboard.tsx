import Dashboard from "../Dashboard";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function DashboardExample() {
  return (
    <TooltipProvider>
      <div className="h-screen w-full">
        <Dashboard />
      </div>
    </TooltipProvider>
  );
}