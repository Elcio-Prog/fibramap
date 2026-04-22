import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import WsProcessor from "@/components/ws/WsProcessor";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function WsBatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const batchTitle = searchParams.get("title") || undefined;

  if (!batchId) {
    return <div className="p-6">Lote não encontrado</div>;
  }

  return (
    <div className="px-2 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ws/searches")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Minhas Buscas
        </Button>
        <h1 className="text-2xl font-bold">Detalhe da Busca</h1>
      </div>

      <WsProcessor
        batchId={batchId}
        batchTitle={batchTitle}
        onReset={() => navigate("/ws")}
      />
    </div>
  );
}
