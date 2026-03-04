import { useParams, useNavigate } from "react-router-dom";
import WsProcessor from "@/components/ws/WsProcessor";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function WsBatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();

  if (!batchId) {
    return <div className="p-6">Lote não encontrado</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ws/searches")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Minhas Buscas
        </Button>
        <h1 className="text-2xl font-bold">Detalhe da Busca</h1>
      </div>

      <WsProcessor
        batchId={batchId}
        onReset={() => navigate("/ws")}
      />
    </div>
  );
}
