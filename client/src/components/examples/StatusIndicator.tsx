import StatusIndicator from "../StatusIndicator";

export default function StatusIndicatorExample() {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <h4 className="font-medium">Without Labels</h4>
        <div className="flex items-center gap-4">
          <StatusIndicator status="active" size="sm" />
          <StatusIndicator status="maintenance" size="md" />
          <StatusIndicator status="error" size="lg" />
          <StatusIndicator status="inactive" size="md" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h4 className="font-medium">With Labels</h4>
        <div className="space-y-2">
          <StatusIndicator status="active" showLabel />
          <StatusIndicator status="maintenance" showLabel />
          <StatusIndicator status="error" showLabel />
          <StatusIndicator status="inactive" showLabel />
        </div>
      </div>
    </div>
  );
}