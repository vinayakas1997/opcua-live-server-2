import LiveDataTable from "../LiveDataTable";
import { mockNodeData } from "@shared/schema";

export default function LiveDataTableExample() {
  return (
    <div className="p-4 max-w-6xl">
      <LiveDataTable
        data={mockNodeData}
        onExportCSV={() => console.log('Export CSV clicked')}
        onRefresh={() => console.log('Refresh clicked')}
      />
    </div>
  );
}