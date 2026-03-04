import { useState } from "react";
import { useNavigate } from "react-router-dom";
import WsUpload from "@/components/ws/WsUpload";
import WsProcessor from "@/components/ws/WsProcessor";

export default function WsUploadPage() {
  const [batchId, setBatchId] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Upload & Viabilidade WS</h1>

      {!batchId ? (
        <WsUpload onBatchCreated={(id) => setBatchId(id)} />
      ) : (
        <WsProcessor
          batchId={batchId}
          onReset={() => setBatchId(null)}
        />
      )}
    </div>
  );
}
