import { useState } from "react";
import WsUpload from "@/components/ws/WsUpload";

export default function WsDashboard() {
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Ferramenta WS</h1>
      <WsUpload onBatchCreated={(id) => setLastBatchId(id)} />
      {lastBatchId && (
        <p className="text-sm text-muted-foreground">
          Último lote importado: <span className="font-mono text-xs">{lastBatchId}</span>
        </p>
      )}
    </div>
  );
}
