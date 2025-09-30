import StatusIndicator from "../StatusIndicator";

export default function StatusIndicatorExample() {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <h4 className="font-medium">Without Labels</h4>
        <div className="flex items-center gap-4">
          <StatusIndicator status="connected" size="sm" />
          <StatusIndicator status="disconnected" size="md" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h4 className="font-medium">With Labels</h4>
        <div className="space-y-2">
          <StatusIndicator status="connected" showLabel />
          <StatusIndicator status="disconnected" showLabel />
        </div>
      </div>
    </div>
  );
}