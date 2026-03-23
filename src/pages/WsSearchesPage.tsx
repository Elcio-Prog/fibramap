import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  List,
  Play,
  RotateCcw,
  Eye,
  Copy,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pause,
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: Clock },
  uploaded: { label: "Aguardando", color: "bg-muted text-muted-foreground", icon: Clock },
  processing: { label: "Processando", color: "bg-primary/10 text-primary", icon: Loader2 },
  paused: { label: "Pausado", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Pause },
  processed: { label: "Concluído", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  completed: { label: "Concluído", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
};

export default function WsSearchesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const { data: batches, isLoading, refetch } = useQuery({
    queryKey: ["ws-batches", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ws_batches")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const openBatch = (batchId: string, title?: string) => {
    const params = title ? `?title=${encodeURIComponent(title)}` : "";
    navigate(`/ws/batch/${batchId}${params}`);
  };

  const refazerBusca = async (batchId: string) => {
    if (!user?.id) return;
    try {
      // Get original batch
      const { data: original } = await supabase
        .from("ws_batches")
        .select("*")
        .eq("id", batchId)
        .single();
      if (!original) return;

      const parentId = original.parent_batch_id || original.id;

      // Find current max version for this parent
      const { data: siblings } = await supabase
        .from("ws_batches")
        .select("version_number")
        .or(`id.eq.${parentId},parent_batch_id.eq.${parentId}`)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion = (siblings?.[0]?.version_number || 1) + 1;

      // Create new batch
      const { data: newBatch, error: batchErr } = await supabase
        .from("ws_batches")
        .insert({
          user_id: user.id,
          file_name: original.file_name,
          title: original.title,
          total_items: original.total_items,
          version_number: nextVersion,
          parent_batch_id: parentId,
          status: "uploaded",
        })
        .select("id")
        .single();

      if (batchErr || !newBatch) throw batchErr;

      // Copy items from original batch (reset processing status, preserve user observations)
      const allItems: any[] = [];
      let offset = 0;
      const batchSize = 500;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase
          .from("ws_feasibility_items")
          .select("*")
          .eq("batch_id", batchId)
          .order("row_number")
          .range(offset, offset + batchSize - 1);
        if (data && data.length > 0) {
          allItems.push(...data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // Insert copied items with reset processing but preserved user observations
      for (let i = 0; i < allItems.length; i += 500) {
        const chunk = allItems.slice(i, i + 500).map((item: any) => ({
          batch_id: newBatch.id,
          row_number: item.row_number,
          designacao: item.designacao,
          cliente: item.cliente,
          tipo_link: item.tipo_link,
          velocidade_original: item.velocidade_original,
          velocidade_mbps: item.velocidade_mbps,
          is_l2l: item.is_l2l,
          l2l_suffix: item.l2l_suffix,
          l2l_pair_id: item.l2l_pair_id,
          endereco_a: item.endereco_a,
          cidade_a: item.cidade_a,
          uf_a: item.uf_a,
          cep_a: item.cep_a,
          numero_a: item.numero_a,
          lat_a: item.lat_a,
          lng_a: item.lng_a,
          endereco_b: item.endereco_b,
          cidade_b: item.cidade_b,
          uf_b: item.uf_b,
          cep_b: item.cep_b,
          numero_b: item.numero_b,
          lat_b: item.lat_b,
          lng_b: item.lng_b,
          prazo_ativacao: item.prazo_ativacao,
          vigencia: item.vigencia,
          taxa_instalacao: item.taxa_instalacao,
          bloco_ip: item.bloco_ip,
          cnpj_cliente: item.cnpj_cliente,
          tipo_solicitacao: item.tipo_solicitacao,
          valor_a_ser_vendido: item.valor_a_ser_vendido,
          codigo_smark: item.codigo_smark,
          raw_data: item.raw_data,
          // Preserve user observations
          observacoes_user: item.observacoes_user,
          observacoes_user_updated_at: item.observacoes_user_updated_at,
          // Reset processing
          processing_status: "pending",
          result_stage: null,
          result_provider: null,
          result_value: null,
          result_notes: null,
          is_viable: null,
          observacoes_system: null,
          attempt_count: 0,
          error_message: null,
        }));
        await supabase.from("ws_feasibility_items").insert(chunk);
      }

      toast({ title: `Versão ${nextVersion} criada com sucesso!` });
      refetch();
      openBatch(newBatch.id);
    } catch (err: any) {
      toast({ title: "Erro ao refazer busca", description: err.message, variant: "destructive" });
    }
  };

  const duplicarBusca = async (batchId: string) => {
    if (!user?.id) return;
    setDuplicating(batchId);
    try {
      const { data: original } = await supabase
        .from("ws_batches")
        .select("*")
        .eq("id", batchId)
        .single();
      if (!original) return;

      const { data: newBatch, error: batchErr } = await supabase
        .from("ws_batches")
        .insert({
          user_id: user.id,
          file_name: original.file_name,
          title: original.title ? `${original.title} (cópia)` : null,
          total_items: original.total_items,
          version_number: 1,
          status: "uploaded",
        })
        .select("id")
        .single();

      if (batchErr || !newBatch) throw batchErr;

      // Copy items
      const allItems: any[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase
          .from("ws_feasibility_items")
          .select("*")
          .eq("batch_id", batchId)
          .order("row_number")
          .range(offset, offset + 499);
        if (data && data.length > 0) {
          allItems.push(...data);
          offset += 500;
          hasMore = data.length === 500;
        } else {
          hasMore = false;
        }
      }

      for (let i = 0; i < allItems.length; i += 500) {
        const chunk = allItems.slice(i, i + 500).map((item: any) => ({
          batch_id: newBatch.id,
          row_number: item.row_number,
          designacao: item.designacao,
          cliente: item.cliente,
          tipo_link: item.tipo_link,
          velocidade_original: item.velocidade_original,
          velocidade_mbps: item.velocidade_mbps,
          is_l2l: item.is_l2l,
          l2l_suffix: item.l2l_suffix,
          l2l_pair_id: item.l2l_pair_id,
          endereco_a: item.endereco_a,
          cidade_a: item.cidade_a,
          uf_a: item.uf_a,
          cep_a: item.cep_a,
          numero_a: item.numero_a,
          lat_a: item.lat_a,
          lng_a: item.lng_a,
          endereco_b: item.endereco_b,
          cidade_b: item.cidade_b,
          uf_b: item.uf_b,
          cep_b: item.cep_b,
          numero_b: item.numero_b,
          lat_b: item.lat_b,
          lng_b: item.lng_b,
          prazo_ativacao: item.prazo_ativacao,
          vigencia: item.vigencia,
          taxa_instalacao: item.taxa_instalacao,
          bloco_ip: item.bloco_ip,
          cnpj_cliente: item.cnpj_cliente,
          tipo_solicitacao: item.tipo_solicitacao,
          valor_a_ser_vendido: item.valor_a_ser_vendido,
          codigo_smark: item.codigo_smark,
          raw_data: item.raw_data,
          processing_status: "pending",
        }));
        await supabase.from("ws_feasibility_items").insert(chunk);
      }

      toast({ title: "Busca duplicada com sucesso!" });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao duplicar", description: err.message, variant: "destructive" });
    } finally {
      setDuplicating(null);
    }
  };

  // Group batches by parent for version display
  const groupedBatches = batches?.reduce((acc, batch) => {
    const parentId = batch.parent_batch_id || batch.id;
    if (!acc[parentId]) acc[parentId] = [];
    acc[parentId].push(batch);
    acc[parentId].sort((a: any, b: any) => b.version_number - a.version_number);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <List className="h-6 w-6" /> Minhas Buscas
        </h1>
        <Button onClick={() => navigate("/ws")} className="gap-2">
          <Play className="h-4 w-4" /> Nova Busca
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (!batches || batches.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhuma busca encontrada. Clique em "Nova Busca" para começar.</p>
          </CardContent>
        </Card>
      )}

      {groupedBatches && Object.entries(groupedBatches).map(([parentId, versions]) => {
        const latest = versions[0];
        const progressPct = latest.total_items > 0
          ? Math.round((latest.processed_items / latest.total_items) * 100)
          : 0;
        const statusInfo = STATUS_MAP[latest.status] || STATUS_MAP.pending;
        const StatusIcon = statusInfo.icon;
        const canResume = ["processing", "paused", "uploaded"].includes(latest.status) &&
          latest.processed_items < latest.total_items;
        const isComplete = latest.status === "processed" || latest.status === "completed";

        return (
          <Card key={parentId} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {latest.title || latest.file_name}
                    {versions.length > 1 && (
                      <Badge variant="outline" className="text-[10px]">
                        {versions.length} versões
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>v{latest.version_number}</span>
                    <span>•</span>
                    <span>{new Date(latest.created_at).toLocaleDateString("pt-BR")}</span>
                    <span>•</span>
                    <span>{latest.total_items} itens</span>
                  </div>
                </div>
                <Badge className={`${statusInfo.color} gap-1 text-xs`}>
                  <StatusIcon className="h-3 w-3" />
                  {statusInfo.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Progress bar */}
              {latest.total_items > 0 && (
                <div className="space-y-1">
                  <Progress value={progressPct} className="h-2" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{latest.processed_items}/{latest.total_items} processados</span>
                    {latest.failed_items > 0 && (
                      <span className="text-destructive">{latest.failed_items} falhas</span>
                    )}
                    <span>{progressPct}%</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openBatch(latest.id, latest.title || latest.file_name)}>
                  <Eye className="h-3 w-3" /> Abrir
                </Button>
                {canResume && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openBatch(latest.id)}>
                    <Play className="h-3 w-3" /> Retomar
                  </Button>
                )}
                {isComplete && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => refazerBusca(latest.id)}>
                    <RotateCcw className="h-3 w-3" /> Refazer (v{latest.version_number + 1})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs"
                  disabled={duplicating === latest.id}
                  onClick={() => duplicarBusca(latest.id)}
                >
                  {duplicating === latest.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
                  Duplicar
                </Button>
              </div>

              {/* Version history (if > 1 version) */}
              {versions.length > 1 && (
                <div className="border-t pt-2 mt-2">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Versões anteriores:</p>
                  <div className="flex flex-wrap gap-1">
                    {versions.slice(1).map((v: any) => {
                      const vStatus = STATUS_MAP[v.status] || STATUS_MAP.pending;
                      return (
                        <Button
                          key={v.id}
                          size="sm"
                          variant="ghost"
                          className="text-[10px] h-6 px-2 gap-1"
                          onClick={() => openBatch(v.id)}
                        >
                          v{v.version_number}
                          <Badge className={`${vStatus.color} text-[9px] px-1 py-0`}>
                            {vStatus.label}
                          </Badge>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
