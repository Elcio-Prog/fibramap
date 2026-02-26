import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useProviders } from "@/hooks/useProviders";
import { useGeoElements } from "@/hooks/useGeoElements";
import { useLpuItems } from "@/hooks/useLpuItems";
import { useComprasLM } from "@/hooks/useComprasLM";
import { supabase } from "@/integrations/supabase/client";
import { processWsBatch, type WsResult, type WsItemInput, type ProcessingProgress } from "@/lib/ws-feasibility-engine";
import { Play, Download, Loader2, CheckCircle2, XCircle, MapPin } from "lucide-react";

interface Props {
  batchId: string;
  onReset?: () => void;
}

export default function WsProcessor({ batchId, onReset }: Props) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [results, setResults] = useState<WsResult[] | null>(null);

  const { toast } = useToast();
  const { data: providers, isLoading: loadingProviders } = useProviders();
  const { data: geoElements, isLoading: loadingGeo } = useGeoElements();
  const { data: lpuItems, isLoading: loadingLpu } = useLpuItems();
  const { data: comprasLM, isLoading: loadingLM } = useComprasLM();

  const isLoadingData = loadingProviders || loadingGeo || loadingLpu || loadingLM;

  const startProcessing = async () => {
    if (!providers?.length) {
      toast({ title: "Cadastre ao menos um provedor antes de processar", variant: "destructive" });
      return;
    }

    setProcessing(true);
    setResults(null);

    try {
      // Fetch batch items
      const allItems: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("ws_feasibility_items")
          .select("*")
          .eq("batch_id", batchId)
          .order("row_number")
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allItems.push(...data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      if (allItems.length === 0) {
        toast({ title: "Nenhum item encontrado no lote", variant: "destructive" });
        setProcessing(false);
        return;
      }

      const wsItems: WsItemInput[] = allItems.map((row) => ({
        id: row.id,
        designacao: row.designacao,
        cliente: row.cliente,
        tipo_link: row.tipo_link,
        velocidade_mbps: row.velocidade_mbps,
        endereco_a: row.endereco_a,
        cidade_a: row.cidade_a,
        uf_a: row.uf_a,
        lat_a: row.lat_a,
        lng_a: row.lng_a,
        endereco_b: row.endereco_b,
        cidade_b: row.cidade_b,
        uf_b: row.uf_b,
        lat_b: row.lat_b,
        lng_b: row.lng_b,
        prazo_ativacao: row.prazo_ativacao,
        is_l2l: row.is_l2l || false,
        l2l_suffix: row.l2l_suffix,
        l2l_pair_id: row.l2l_pair_id,
        row_number: row.row_number,
      }));

      const batchResults = await processWsBatch(
        wsItems,
        providers as any,
        geoElements as any,
        lpuItems || [],
        comprasLM || [],
        (p) => setProgress(p),
      );

      setResults(batchResults);

      // Save results back to DB (fire-and-forget)
      const updates = batchResults.map((r) =>
        supabase
          .from("ws_feasibility_items")
          .update({
            lat_a: r.geo_lat,
            lng_a: r.geo_lng,
            processing_status: r.is_viable ? "viable" : r.geo_source === "nao_encontrado" ? "geo_failed" : "not_viable",
            result_stage: r.stage,
            result_provider: r.provider_name,
            result_value: r.final_value,
            result_notes: r.notes,
            is_viable: r.is_viable,
          })
          .eq("id", r.item.id)
      );
      Promise.all(updates).catch(() => {});

      // Update batch status
      supabase.from("ws_batches").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", batchId).then(() => {});

      toast({ title: `Processamento concluído — ${batchResults.length} itens` });
    } catch (err: any) {
      toast({ title: "Erro no processamento", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const exportToExcel = () => {
    if (!results) return;

    const rows = results.map((r) => ({
      "Linha": r.item.row_number,
      "Designação": r.item.designacao || "",
      "Cliente": r.item.cliente || "",
      "Tipo Link": r.item.tipo_link || "",
      "Vel. (Mbps)": r.item.velocidade_mbps ?? "",
      "L2L": r.item.is_l2l ? `Sim (${r.item.l2l_suffix})` : "Não",
      "Endereço A": r.item.endereco_a || "",
      "Cidade A": r.item.cidade_a || "",
      "UF A": r.item.uf_a || "",
      "Lat A": r.geo_lat ?? "",
      "Lng A": r.geo_lng ?? "",
      "Endereço B": r.item.endereco_b || "",
      "Cidade B": r.item.cidade_b || "",
      "UF B": r.item.uf_b || "",
      "Lat B": r.item.lat_b ?? "",
      "Lng B": r.item.lng_b ?? "",
      "Prazo Ativação": r.item.prazo_ativacao || "",
      "Geo Fonte": r.geo_source === "coordenada" ? "Coordenada" : r.geo_source === "endereco" ? "Endereço" : "Não encontrado",
      "Viável": r.is_viable ? "SIM" : "NÃO",
      "Etapa": r.stage || "—",
      "Provedor": r.provider_name || "—",
      "Distância (m)": r.distance_m ?? "",
      "Valor LPU": r.lpu_value ?? "",
      "Valor Final": r.final_value ?? "",
      "Observações": r.notes,
      "TA/CE": r.ta_info || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultado WS");

    // Auto-size columns
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] || "").length).slice(0, 50)) + 2,
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `resultado_ws_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const viableCount = results?.filter((r) => r.is_viable).length ?? 0;
  const notViableCount = results?.filter((r) => !r.is_viable).length ?? 0;
  const geoFailCount = results?.filter((r) => r.geo_source === "nao_encontrado").length ?? 0;

  // Group by stage
  const stageGroups: Record<string, number> = {};
  results?.forEach((r) => {
    const key = r.stage || "Sem viabilidade";
    stageGroups[key] = (stageGroups[key] || 0) + 1;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Processamento de Viabilidade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pre-processing */}
        {!results && !processing && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O motor irá verificar cada item contra a rede NTT, provedores parceiros e base LM histórica.
              Coordenadas são priorizadas; endereços são geocodificados quando necessário.
            </p>
            <Button className="w-full gap-2" onClick={startProcessing} disabled={isLoadingData}>
              {isLoadingData ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Carregando dados de rede...</>
              ) : (
                <><Play className="h-4 w-4" /> Iniciar processamento</>
              )}
            </Button>
          </div>
        )}

        {/* Processing */}
        {processing && progress && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </span>
              <span className="font-mono text-xs">
                {progress.current}/{progress.total}
              </span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} />
            <p className="text-xs text-muted-foreground truncate">
              {progress.currentItem}
            </p>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-4">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{results.length} itens</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Viáveis: {viableCount}
              </Badge>
              <Badge variant="outline" className="text-destructive border-destructive/30">
                <XCircle className="h-3 w-3 mr-1" /> Inviáveis: {notViableCount}
              </Badge>
              {geoFailCount > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  Geo falhou: {geoFailCount}
                </Badge>
              )}
            </div>

            {/* Stage breakdown */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(stageGroups).map(([stage, count]) => (
                <Badge key={stage} variant="outline" className="text-xs">
                  {stage}: {count}
                </Badge>
              ))}
            </div>

            {/* Results table */}
            <div className="overflow-x-auto max-h-[500px] border rounded-md">
              <table className="text-xs w-full">
                <thead className="sticky top-0 bg-muted z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left">#</th>
                    <th className="px-2 py-1.5 text-left">Designação</th>
                    <th className="px-2 py-1.5 text-left">Cliente</th>
                    <th className="px-2 py-1.5 text-left">Vel.</th>
                    <th className="px-2 py-1.5 text-left">Endereço</th>
                    <th className="px-2 py-1.5 text-left">Geo</th>
                    <th className="px-2 py-1.5 text-left">Viável</th>
                    <th className="px-2 py-1.5 text-left">Etapa</th>
                    <th className="px-2 py-1.5 text-left">Provedor</th>
                    <th className="px-2 py-1.5 text-left">Dist.</th>
                    <th className="px-2 py-1.5 text-left">Valor</th>
                    <th className="px-2 py-1.5 text-left">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className={`border-t ${r.is_viable ? "" : "bg-destructive/5"}`}>
                      <td className="px-2 py-1">{r.item.row_number}</td>
                      <td className="px-2 py-1 max-w-[100px] truncate">{r.item.designacao || "—"}</td>
                      <td className="px-2 py-1 max-w-[100px] truncate">{r.item.cliente || "—"}</td>
                      <td className="px-2 py-1">{r.item.velocidade_mbps ?? "—"}</td>
                      <td className="px-2 py-1 max-w-[160px] truncate">{r.item.endereco_a || "—"}</td>
                      <td className="px-2 py-1">
                        {r.geo_source === "coordenada" ? "📍" : r.geo_source === "endereco" ? "🔍" : "❌"}
                      </td>
                      <td className="px-2 py-1">
                        {r.is_viable ? (
                          <Badge className="text-[10px] px-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">SIM</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1 text-destructive">NÃO</Badge>
                        )}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">{r.stage || "—"}</td>
                      <td className="px-2 py-1 max-w-[100px] truncate">{r.provider_name || "—"}</td>
                      <td className="px-2 py-1">{r.distance_m != null ? `${r.distance_m}m` : "—"}</td>
                      <td className="px-2 py-1">{r.final_value != null ? `R$${r.final_value}` : "—"}</td>
                      <td className="px-2 py-1 max-w-[200px] truncate">{r.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button className="gap-2" onClick={exportToExcel}>
                <Download className="h-4 w-4" /> Exportar Excel
              </Button>
              <Button variant="outline" onClick={onReset}>
                Novo upload
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
