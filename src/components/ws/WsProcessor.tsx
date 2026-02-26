import { useState, useEffect, useRef } from "react";
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
import { Play, Download, Loader2, CheckCircle2, XCircle, MapPin, RotateCcw } from "lucide-react";

interface Props {
  batchId: string;
  onReset?: () => void;
}

export default function WsProcessor({ batchId, onReset }: Props) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [results, setResults] = useState<WsResult[] | null>(null);
  const [batchStatus, setBatchStatus] = useState<string>("pending");
  const [totalItems, setTotalItems] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const cancelRef = useRef(false);

  const { toast } = useToast();
  const { data: providers, isLoading: loadingProviders } = useProviders();
  const { data: geoElements, isLoading: loadingGeo } = useGeoElements();
  const { data: lpuItems, isLoading: loadingLpu } = useLpuItems();
  const { data: comprasLM, isLoading: loadingLM } = useComprasLM();

  const isLoadingData = loadingProviders || loadingGeo || loadingLpu || loadingLM;

  // On mount, check batch status and load any existing results
  useEffect(() => {
    loadBatchState();
  }, [batchId]);

  const loadBatchState = async () => {
    setLoading(true);
    try {
      // Get batch info
      const { data: batch } = await supabase
        .from("ws_batches")
        .select("status, total_items")
        .eq("id", batchId)
        .single();

      if (batch) {
        setBatchStatus(batch.status);
        setTotalItems(batch.total_items);
      }

      // Count already processed items
      const { count: doneCount } = await supabase
        .from("ws_feasibility_items")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId)
        .neq("processing_status", "pending");

      setProcessedCount(doneCount || 0);

      // If batch is fully processed, load all results for display
      if (batch?.status === "processed") {
        await loadResults();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadResults = async () => {
    const allItems: any[] = [];
    let offset = 0;
    const batchSize = 1000;
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

    const mapped: WsResult[] = allItems.map((row) => ({
      item: {
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
      },
      geo_lat: row.lat_a,
      geo_lng: row.lng_a,
      geo_source: row.processing_status === "geo_failed" ? "nao_encontrado" : row.lat_a != null ? "coordenada" : "nao_encontrado",
      stage: row.result_stage,
      provider_name: row.result_provider,
      distance_m: null,
      lpu_value: null,
      final_value: row.result_value,
      is_viable: row.is_viable ?? false,
      notes: row.result_notes || "",
      all_options: [],
    }));

    setResults(mapped);
  };

  const startProcessing = async (resume = false) => {
    if (!providers?.length) {
      toast({ title: "Cadastre ao menos um provedor antes de processar", variant: "destructive" });
      return;
    }

    cancelRef.current = false;
    setProcessing(true);
    if (!resume) setResults(null);
    
    // Show progress immediately so user knows it started
    setProgress({ current: 0, total: totalItems || 1, currentItem: "Preparando dados..." });

    try {
      // Fetch all batch items
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

      // Find first unprocessed item index
      let startIndex = 0;
      const previousResults: WsResult[] = [];

      if (resume) {
        for (let i = 0; i < allItems.length; i++) {
          if (allItems[i].processing_status !== "pending") {
            previousResults.push({
              item: mapRowToInput(allItems[i]),
              geo_lat: allItems[i].lat_a,
              geo_lng: allItems[i].lng_a,
              geo_source: allItems[i].processing_status === "geo_failed" ? "nao_encontrado" : "coordenada",
              stage: allItems[i].result_stage,
              provider_name: allItems[i].result_provider,
              distance_m: null,
              lpu_value: null,
              final_value: allItems[i].result_value,
              is_viable: allItems[i].is_viable ?? false,
              notes: allItems[i].result_notes || "",
              all_options: [],
            });
            startIndex = i + 1;
          } else {
            break;
          }
        }
      }

      // Update batch status to processing
      await supabase.from("ws_batches").update({ status: "processing" }).eq("id", batchId);
      setBatchStatus("processing");

      const wsItems: WsItemInput[] = allItems.map(mapRowToInput);

      const accumulated = [...previousResults];
      setResults(accumulated.length > 0 ? [...accumulated] : null);

      const batchResults = await processWsBatch(
        wsItems,
        providers as any,
        geoElements as any,
        lpuItems || [],
        comprasLM || [],
        (p) => setProgress(p),
        (result, _index) => {
          accumulated.push(result);
          setResults([...accumulated]);
          setProcessedCount(accumulated.length);
        },
        startIndex,
      );

      const allResults = [...previousResults, ...batchResults];
      setResults(allResults);

      // Update batch status
      await supabase.from("ws_batches").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", batchId);
      setBatchStatus("processed");

      toast({ title: `Processamento concluído — ${allResults.length} itens` });
    } catch (err: any) {
      // Even on error, progress is saved in DB
      toast({ title: "Erro no processamento", description: err.message, variant: "destructive" });
      await supabase.from("ws_batches").update({ status: "paused" }).eq("id", batchId);
      setBatchStatus("paused");
    } finally {
      setProcessing(false);
    }
  };

  const mapRowToInput = (row: any): WsItemInput => ({
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
  });

  const exportToExcel = () => {
    if (!results) return;

    const rows: Record<string, any>[] = [];
    for (const r of results) {
      // Build all options columns dynamically
      const optionsText = r.all_options.length > 0
        ? r.all_options.map((o, i) => `${i + 1}) ${o.stage} - ${o.provider_name} - ${o.distance_m}m${o.final_value != null ? ` - R$${o.final_value}` : ""}${o.ta_info ? ` [${o.ta_info}]` : ""}`).join(" | ")
        : "";

      rows.push({
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
        "Qtd Opções": r.all_options.length,
        "Melhor Etapa": r.stage || "—",
        "Melhor Provedor": r.provider_name || "—",
        "Distância (m)": r.distance_m ?? "",
        "Valor LPU": r.lpu_value ?? "",
        "Valor Final": r.final_value ?? "",
        "TA/CE": r.ta_info || "",
        "Todas as Opções": optionsText,
        "Observações": r.notes,
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultado WS");

    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] || "").length).slice(0, 50)) + 2,
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `resultado_ws_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const viableCount = results?.filter((r) => r.is_viable).length ?? 0;
  const notViableCount = results?.filter((r) => !r.is_viable).length ?? 0;
  const geoFailCount = results?.filter((r) => r.geo_source === "nao_encontrado").length ?? 0;

  const stageGroups: Record<string, number> = {};
  results?.forEach((r) => {
    const key = r.stage || "Sem viabilidade";
    stageGroups[key] = (stageGroups[key] || 0) + 1;
  });

  const canResume = (batchStatus === "processing" || batchStatus === "paused") && processedCount > 0 && processedCount < totalItems;
  const isComplete = batchStatus === "processed";

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando estado do lote...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Processamento de Viabilidade
          {canResume && !processing && (
            <Badge variant="outline" className="ml-2 text-xs">
              {processedCount}/{totalItems} processados
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pre-processing or Resume */}
        {!results && !processing && !isComplete && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O motor irá verificar cada item contra a rede NTT, provedores parceiros e base LM histórica.
              {canResume && " O progresso anterior será retomado de onde parou."}
            </p>
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" onClick={() => startProcessing(canResume)} disabled={isLoadingData}>
                {isLoadingData ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Carregando dados de rede...</>
                ) : canResume ? (
                  <><RotateCcw className="h-4 w-4" /> Retomar processamento ({processedCount}/{totalItems})</>
                ) : (
                  <><Play className="h-4 w-4" /> Iniciar processamento</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Processing */}
        {processing && progress && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando... (progresso salvo automaticamente)
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

        {/* Results (shown during processing and after) */}
        {results && results.length > 0 && (
          <div className="space-y-4">
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

            <div className="flex flex-wrap gap-2">
              {Object.entries(stageGroups).map(([stage, count]) => (
                <Badge key={stage} variant="outline" className="text-xs">
                  {stage}: {count}
                </Badge>
              ))}
            </div>

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
                    <th className="px-2 py-1.5 text-left">Opções</th>
                    <th className="px-2 py-1.5 text-left">Melhor Etapa</th>
                    <th className="px-2 py-1.5 text-left">Provedor</th>
                    <th className="px-2 py-1.5 text-left">Dist.</th>
                    <th className="px-2 py-1.5 text-left">Valor</th>
                    <th className="px-2 py-1.5 text-left">Todas Opções</th>
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
                      <td className="px-2 py-1">
                        {r.all_options.length > 0 ? (
                          <Badge variant="outline" className="text-[10px] px-1">{r.all_options.length}</Badge>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">{r.stage || "—"}</td>
                      <td className="px-2 py-1 max-w-[100px] truncate">{r.provider_name || "—"}</td>
                      <td className="px-2 py-1">{r.distance_m != null ? `${r.distance_m}m` : "—"}</td>
                      <td className="px-2 py-1">{r.final_value != null ? `R$${r.final_value}` : "—"}</td>
                      <td className="px-2 py-1 max-w-[250px] text-[10px]">
                        {r.all_options.length > 1 ? (
                          r.all_options.map((o, oi) => (
                            <div key={oi} className={oi === 0 ? "font-semibold" : "text-muted-foreground"}>
                              {o.stage}/{o.provider_name} {o.distance_m}m {o.final_value != null ? `R$${o.final_value}` : ""}
                            </div>
                          ))
                        ) : r.notes ? (
                          <span className="truncate">{r.notes}</span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {!processing && (
                <>
                  <Button className="gap-2" onClick={exportToExcel}>
                    <Download className="h-4 w-4" /> Exportar Excel
                  </Button>
                  {canResume && (
                    <Button variant="secondary" className="gap-2" onClick={() => startProcessing(true)}>
                      <RotateCcw className="h-4 w-4" /> Retomar
                    </Button>
                  )}
                  <Button variant="outline" onClick={onReset}>
                    Novo upload
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Completed batch - load results */}
        {isComplete && !results && !processing && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Este lote já foi processado ({totalItems} itens).
            </p>
            <div className="flex gap-2">
              <Button className="gap-2" onClick={loadResults}>
                <Download className="h-4 w-4" /> Carregar resultados
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
