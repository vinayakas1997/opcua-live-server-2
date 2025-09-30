import { cn } from "@/lib/utils";
import type { PLCStatus, ConnectionStatus } from "@shared/schema";

interface StatusIndicatorProps {
  status: PLCStatus | ConnectionStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const statusConfig = {
  connected: {
    color: "bg-green-500",
    label: "Connected",
    labelJp: "接続済み",
  },
  disconnected: {
    color: "bg-red-500",
    label: "Disconnected",
    labelJp: "未接続",
  },
};

const sizeConfig = {
  sm: "w-2 h-2",
  md: "w-3 h-3", 
  lg: "w-4 h-4",
};

export default function StatusIndicator({ 
  status, 
  size = "md", 
  showLabel = false,
  className 
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        "rounded-full shrink-0",
        config.color,
        sizeConfig[size]
      )} />
      {showLabel && (
        <span className="text-sm text-muted-foreground">
          {config.label}
        </span>
      )}
    </div>
  );
}