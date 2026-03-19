import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useProviders } from "@/hooks/useProviders";
import { useGeoElements } from "@/hooks/useGeoElements";
import { useLpuItems } from "@/hooks/useLpuItems";
import { useComprasLM } from "@/hooks/useComprasLM";
import { usePreProviders, useAllPreProviderCities } from "@/hooks/usePreProviders";
import { supabase } from "@/integrations/supabase/client";
import { processWsBatch, type WsResult, type WsItemInput, type ProcessingProgress, type PreProviderWithCities } from "@/lib/ws-feasibility-engine";
import { Play, Download, Loader2, CheckCircle2, XCircle, MapPin, RotateCcw, Save, Filter, Pencil } from "lucide-react";
import ScrollableTable from "@/components/ui/scrollable-table";
import { useCart, CartItem } from "@/contexts/CartContext";
import { SelectionCheckbox, FloatingActionBar } from "@/components/cart/SelectionUI";

import { TIPO_SOLICITACAO_OPTIONS, BLOCO_IP_OPTIONS, VIGENCIA_OPTIONS } from "@/lib/field-options";

const PRODUTO_OPTIONS = [
  "NT LINK DEDICADO FULL", "NT LINK DEDICADO FLEX", "NT LINK EMPRESA",
  "NT LINK IP TRANSITO", "NT EVENTO", "NT PTT", "NT L2L", "NT DARK FIBER",
];
const TECNOLOGIA_OPTIONS = ["GPON", "PTP", "LAST MILE"];
const MEIO_FISICO_OPTIONS = ["Fibra", "Rádio"];

/** Inline editable cell for the results table */
function InlineEdit({ value, type = "text", onSave, width = "w-[80px]", options }: { value: string; type?: "text" | "number"; onSave: (v: string) => void; width?: string; options?: string[] }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => { if (editing && !options) inputRef.current?.focus(); }, [editing, options]);

  const commit = () => { setEditing(false); if (local !== value) onSave(local); };
  const cancel = () => { setLocal(value); setEditing(false); };

  if (editing && options) {
    return (
      <select
        className={`h-6 text-[10px] px-0.5 ${width} rounded border border-input bg-background`}
        value={local}
        autoFocus
        onChange={e => { const v = e.target.value; setLocal(v); setEditing(false); if (v !== value) onSave(v); }}
        onBlur={() => { setEditing(false); }}
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        className={`h-6 text-[10px] px-1 ${width}`}
        type={type}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
      />
    );
  }

  return (
    <div className={`flex items-center gap-0.5 cursor-pointer group ${width} min-h-[24px] px-1 rounded border border-transparent hover:border-dashed hover:border-muted-foreground/40`} onClick={() => setEditing(true)}>
      <span className="truncate text-[10px]">{value || "—"}</span>
      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
    </div>
  );
}

interface Props {
  batchId: string;
  batchTitle?: string;
  onReset?: () => void;
}

/** Debounce helper for auto-save */
function useDebounce(fn: (...args: any[]) => void, ms: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  return useCallback((...args: any[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), ms);
  }, [fn, ms]);
}

export default function WsProcessor({ batchId, batchTitle, onReset }: Props) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [results, setResults] = useState<WsResult[] | null>(null);
  const [batchStatus, setBatchStatus] = useState<string>("pending");
  const [totalItems, setTotalItems] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "viable" | "check_om" | "not_viable" | "pending" | "failed">("all");
  const [editingObs, setEditingObs] = useState<Record<string, string>>({});
  const [savingObs, setSavingObs] = useState<Record<string, boolean>>({});
  const [editingFields, setEditingFields] = useState<Record<string, Record<string, any>>>({});
  const cancelRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Raw DB rows for observações tracking
  const [dbRows, setDbRows] = useState<Record<string, any>>({});

  const { isInCart, isSent, loadSentIds } = useCart();

  const { toast } = useToast();
  const { data: providers, isLoading: loadingProviders } = useProviders();
  const { data: geoElements, isLoading: loadingGeo } = useGeoElements();
  const { data: lpuItems, isLoading: loadingLpu } = useLpuItems();
  const { data: comprasLM, isLoading: loadingLM } = useComprasLM();
  const { data: preProviders, isLoading: loadingPreProv } = usePreProviders();
  const { data: preProviderCities, isLoading: loadingPreCities } = useAllPreProviderCities();

  const isLoadingData = loadingProviders || loadingGeo || loadingLpu || loadingLM || loadingPreProv || loadingPreCities;

  // Build pre-providers with cities for engine
  const preProvidersWithCities: PreProviderWithCities[] = (preProviders || [])
    .filter(pp => pp.status === "pre_cadastro")
    .map(pp => ({
      id: pp.id,
      nome_fantasia: pp.nome_fantasia,
      has_cross_ntt: pp.has_cross_ntt,
      cities: (preProviderCities || [])
        .filter(c => c.pre_provider_id === pp.id)
        .map(c => ({ cidade: c.cidade, estado: c.estado })),
    }))
    .filter(pp => pp.cities.length > 0);

  useEffect(() => {
    loadBatchState();
  }, [batchId]);

  const loadBatchState = async () => {
    setLoading(true);
    try {
      const { data: batch } = await supabase
        .from("ws_batches")
        .select("status, total_items")
        .eq("id", batchId)
        .single();

      if (batch) {
        setBatchStatus(batch.status);
        setTotalItems(batch.total_items);
      }

      const { count: doneCount } = await supabase
        .from("ws_feasibility_items")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batchId)
        .neq("processing_status", "pending");

      setProcessedCount(doneCount || 0);

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

    // Store raw rows for observações tracking
    const rowMap: Record<string, any> = {};
    allItems.forEach(r => { rowMap[r.id] = r; });
    setDbRows(rowMap);

    // Load sent IDs
    const sentItemIds = allItems.filter((r: any) => r.enviado_para_sharepoint).map((r: any) => r.id);
    if (sentItemIds.length > 0) loadSentIds(sentItemIds);

    // Initialize editing obs from user observations
    const obsMap: Record<string, string> = {};
    allItems.forEach(r => {
      obsMap[r.id] = r.observacoes_user || r.observacoes_system || r.result_notes || "";
    });
    setEditingObs(obsMap);

    const mapped: WsResult[] = allItems.map((row) => ({
      item: mapRowToInput(row),
      geo_lat: row.lat_a,
      geo_lng: row.lng_a,
      geo_source: row.processing_status === "geo_failed" ? "nao_encontrado" : row.lat_a != null ? "coordenada" : "nao_encontrado",
      stage: row.result_stage,
      provider_name: row.result_provider,
      distance_m: row.result_distance_m ?? null,
      lpu_value: null,
      final_value: row.result_value,
      is_viable: row.is_viable ?? false,
      is_check_om: row.processing_status === "check_om",
      notes: row.result_notes || "",
      all_options: [],
    }));

    setResults(mapped);
  };

  const saveObservacao = useCallback(async (itemId: string, text: string) => {
    setSavingObs(prev => ({ ...prev, [itemId]: true }));
    try {
      await supabase
        .from("ws_feasibility_items")
        .update({
          observacoes_user: text,
          observacoes_user_updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);
    } catch {
      // silent
    } finally {
      setSavingObs(prev => ({ ...prev, [itemId]: false }));
    }
  }, []);

  const debouncedSave = useDebounce(saveObservacao, 1500);

  const handleObsChange = (itemId: string, text: string) => {
    setEditingObs(prev => ({ ...prev, [itemId]: text }));
    debouncedSave(itemId, text);
  };

  const updateInlineField = useCallback(async (itemId: string, field: string, value: any) => {
    setEditingFields(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [field]: value }
    }));
    // Update dbRows locally
    setDbRows(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [field]: value }
    }));
    try {
      await supabase.from("ws_feasibility_items").update({ [field]: value } as any).eq("id", itemId);
    } catch {
      // silent
    }
  }, []);

  const startProcessing = async (resume = false) => {
    if (!providers?.length) {
      toast({ title: "Cadastre ao menos um provedor antes de processar", variant: "destructive" });
      return;
    }

    cancelRef.current = false;
    setProcessing(true);
    if (!resume) setResults(null);
    setProgress({ current: 0, total: totalItems || 1, currentItem: "Preparando dados..." });

    try {
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
              is_check_om: allItems[i].processing_status === "check_om",
              notes: allItems[i].result_notes || "",
              all_options: [],
            });
            startIndex = i + 1;
          } else {
            break;
          }
        }
      }

      await supabase.from("ws_batches").update({ status: "processing" }).eq("id", batchId);
      setBatchStatus("processing");

      const wsItems: WsItemInput[] = allItems.map(mapRowToInput);
      const accumulated = [...previousResults];
      setResults(accumulated.length > 0 ? [...accumulated] : null);

      let processedSoFar = accumulated.length;
      let failedSoFar = 0;

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
          processedSoFar = accumulated.length;
          if (!result.is_viable && result.geo_source !== "nao_encontrado") failedSoFar++;
          setProcessedCount(accumulated.length);
        },
        startIndex,
        preProvidersWithCities,
      );

      const allResults = [...previousResults, ...batchResults];
      setResults(allResults);

      // Update batch counters
      const totalFailed = allResults.filter(r => !r.is_viable && r.geo_source !== "nao_encontrado").length;
      await supabase.from("ws_batches").update({
        status: "processed",
        processed_at: new Date().toISOString(),
        processed_items: allResults.length,
        failed_items: totalFailed,
      }).eq("id", batchId);
      setBatchStatus("processed");

      toast({ title: `Processamento concluído — ${allResults.length} itens` });

      // Reload to get observacoes
      await loadResults();
    } catch (err: any) {
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
    cep_a: row.cep_a,
    numero_a: row.numero_a,
    lat_a: row.lat_a,
    lng_a: row.lng_a,
    endereco_b: row.endereco_b,
    cidade_b: row.cidade_b,
    uf_b: row.uf_b,
    cep_b: row.cep_b,
    numero_b: row.numero_b,
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

    const maxOptions = results.reduce((max, r) => Math.max(max, r.all_options.length), 0);

    const rows: Record<string, any>[] = [];
    for (const r of results) {
      const dbRow = dbRows[r.item.id];
      const row: Record<string, any> = {
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
        "Vigência": dbRow?.vigencia || "",
        "Taxa de Instalação": dbRow?.taxa_instalacao ?? "",
        "Bloco IP": dbRow?.bloco_ip || "",
        "CNPJ Cliente": dbRow?.cnpj_cliente || "",
        "Tipo de Solicitação": dbRow?.tipo_solicitacao || "",
        "Valor a ser Vendido": dbRow?.valor_a_ser_vendido ?? "",
        "Código Smark": dbRow?.codigo_smark || "",
        "Geo Fonte": r.geo_source === "coordenada" ? "Coordenada" : r.geo_source === "cep" ? "CEP" : r.geo_source === "endereco" ? "Endereço" : "Não encontrado",
        "Viável": r.is_viable ? "SIM" : r.is_check_om ? "Checar O&M disponibilidade" : "NÃO",
        "Qtd Opções": r.all_options.filter(o => !o.is_blocked).length,
        "Melhor Etapa": r.stage || "—",
        "Melhor Provedor": r.provider_name || "—",
        "Distância NTT (m)": r.stage === "Rede Própria" && r.distance_m != null ? r.distance_m : "",
        "Distância (m)": r.distance_m ?? "",
        "Valor LPU": r.lpu_value ?? "",
        "Valor Final": r.final_value ?? "",
        "TA/CE": r.ta_info || "",
        "Observações (Sistema)": dbRow?.observacoes_system || r.notes || "",
        "Observações (Usuário)": editingObs[r.item.id] || "",
      };

      for (let i = 0; i < maxOptions; i++) {
        const o = r.all_options[i];
        const prefix = `Opção ${i + 1}`;
        if (o) {
          row[`${prefix} - Etapa`] = o.is_blocked ? `${o.stage} (INVIÁVEL)` : o.is_check_om ? `${o.stage} (Checar O&M)` : o.stage;
          row[`${prefix} - Provedor`] = o.provider_name;
          row[`${prefix} - Distância (m)`] = o.distance_m;
          row[`${prefix} - Valor LPU`] = o.lpu_value ?? "";
          row[`${prefix} - Valor Final`] = o.final_value ?? "";
          row[`${prefix} - TA/CE`] = o.ta_info || "";
          row[`${prefix} - Obs`] = o.notes;
        } else {
          row[`${prefix} - Etapa`] = "";
          row[`${prefix} - Provedor`] = "";
          row[`${prefix} - Distância (m)`] = "";
          row[`${prefix} - Valor LPU`] = "";
          row[`${prefix} - Valor Final`] = "";
          row[`${prefix} - TA/CE`] = "";
          row[`${prefix} - Obs`] = "";
        }
      }

      rows.push(row);
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

  // Filtered results
  const filteredResults = results?.filter(r => {
    if (filter === "all") return true;
    if (filter === "viable") return r.is_viable;
    if (filter === "check_om") return r.is_check_om;
    if (filter === "not_viable") return !r.is_viable && !r.is_check_om;
    if (filter === "pending") return r.geo_source === "nao_encontrado";
    if (filter === "failed") return !r.is_viable && !r.is_check_om && r.geo_source !== "nao_encontrado";
    return true;
  });

  const viableCount = results?.filter((r) => r.is_viable).length ?? 0;
  const checkOmCount = results?.filter((r) => r.is_check_om).length ?? 0;
  const notViableCount = results?.filter((r) => !r.is_viable && !r.is_check_om).length ?? 0;
  const geoFailCount = results?.filter((r) => r.geo_source === "nao_encontrado").length ?? 0;

  const stageGroups: Record<string, number> = {};
  results?.forEach((r) => {
    const key = r.stage || "Sem viabilidade";
    stageGroups[key] = (stageGroups[key] || 0) + 1;
  });

  const canResume = (batchStatus === "processing" || batchStatus === "paused" || batchStatus === "uploaded") && processedCount < totalItems;
  const isComplete = batchStatus === "processed";

  // Selection helpers
  const selectableIds = useMemo(() => {
    if (!filteredResults) return [];
    return filteredResults
      .filter(r => !isInCart(r.item.id) && !isSent(r.item.id))
      .map(r => r.item.id);
  }, [filteredResults, isInCart, isSent]);

  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  };

  const buildCartItems = (): CartItem[] => {
    if (!filteredResults) return [];
    return filteredResults
      .filter(r => selectedIds.has(r.item.id))
      .map(r => {
        const dbRow = dbRows[r.item.id];
        const coordenadas = r.geo_lat != null && r.geo_lng != null ? `${r.geo_lat}, ${r.geo_lng}` : "";
        return {
          id: r.item.id,
          batchId,
          batchTitle: batchTitle || dbRow?.batch_id || batchId.slice(0, 8),
          designacao: r.item.designacao || "",
          cliente: r.item.cliente || "",
          cnpj_cliente: dbRow?.cnpj_cliente || "",
          endereco: r.item.endereco_a || "",
          cidade: r.item.cidade_a || "",
          uf: r.item.uf_a || "",
          lat: r.geo_lat,
          lng: r.geo_lng,
          is_viable: r.is_viable,
          is_check_om: r.is_check_om,
          stage: r.stage || "",
          provider_name: r.provider_name || "",
          velocidade_mbps: r.item.velocidade_mbps,
          velocidade_original: dbRow?.velocidade_original || "",
          distance_m: r.distance_m,
          final_value: r.final_value,
          vigencia: dbRow?.vigencia || "",
          taxa_instalacao: dbRow?.taxa_instalacao,
          bloco_ip: dbRow?.bloco_ip || "",
          tipo_solicitacao: dbRow?.tipo_solicitacao || "",
          valor_a_ser_vendido: dbRow?.valor_a_ser_vendido,
          codigo_smark: dbRow?.codigo_smark || "",
          observacoes_user: editingObs[r.item.id] || "",
          observacoes_system: dbRow?.observacoes_system || r.notes || "",
          created_at: dbRow?.created_at || new Date().toISOString(),
          produto: dbRow?.produto || "NT LINK DEDICADO FULL",
          tecnologia: dbRow?.tecnologia || "GPON",
          tecnologia_meio_fisico: dbRow?.tecnologia_meio_fisico || "Fibra",
          coordenadas,
        };
      });
  };

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
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{results?.length} itens</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Viáveis: {viableCount}
              </Badge>
              {checkOmCount > 0 && (
                <Badge variant="outline" className="border-yellow-400 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20">
                  ⚠️ Checar O&M: {checkOmCount}
                </Badge>
              )}
              <Badge variant="outline" className="text-destructive border-destructive/30">
                <XCircle className="h-3 w-3 mr-1" /> Inviáveis: {notViableCount}
              </Badge>
              {geoFailCount > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  Geo falhou: {geoFailCount}
                </Badge>
              )}
            </div>

            {/* Stage groups */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(stageGroups).map(([stage, count]) => (
                <Badge key={stage} variant="outline" className="text-xs">
                  {stage}: {count}
                </Badge>
              ))}
            </div>

            {/* Filter */}
            {!processing && (
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="viable">Viáveis</SelectItem>
                    <SelectItem value="check_om">Checar O&M</SelectItem>
                    <SelectItem value="not_viable">Inviáveis</SelectItem>
                    <SelectItem value="pending">Geo falhou</SelectItem>
                    <SelectItem value="failed">Falhas</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {filteredResults.length} de {results?.length}
                </span>
              </div>
            )}

            {/* Results table */}
            {filteredResults && filteredResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum item encontrado para o filtro selecionado.</p>
            )}
            {filteredResults && filteredResults.length > 0 && <ScrollableTable totalScrollableColumns={21}>
              <table className="text-xs w-max min-w-full">
                <thead className="sticky top-0 bg-muted z-10">
                  <tr>
                    {!processing && isComplete && (
                      <th className="px-2 py-1.5 text-center w-8 sticky left-0 z-20 bg-muted">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                          className="h-3.5 w-3.5"
                        />
                      </th>
                    )}
                    <th className={`px-2 py-1.5 text-left sticky ${!processing && isComplete ? 'left-[32px]' : 'left-0'} z-20 bg-muted`}>#</th>
                    <th className="px-2 py-1.5 text-left">Designação</th>
                    <th className="px-2 py-1.5 text-left">Cliente</th>
                    <th className="px-2 py-1.5 text-left">CNPJ</th>
                    <th className="px-2 py-1.5 text-left">Vel.</th>
                    <th className="px-2 py-1.5 text-left">Endereço</th>
                    <th className="px-2 py-1.5 text-left">Coordenadas</th>
                    <th className="px-2 py-1.5 text-left">Geo</th>
                    <th className="px-2 py-1.5 text-left">Viável</th>
                    <th className="px-2 py-1.5 text-left">Melhor Etapa</th>
                    <th className="px-2 py-1.5 text-left">Provedor</th>
                    <th className="px-2 py-1.5 text-left">Produto</th>
                    <th className="px-2 py-1.5 text-left">Tecnologia</th>
                    <th className="px-2 py-1.5 text-left">Meio Físico</th>
                    <th className="px-2 py-1.5 text-left min-w-[200px]">Obs. Usuário</th>
                    <th className="px-2 py-1.5 text-left">Distância</th>
                    <th className="px-2 py-1.5 text-left">Valor</th>
                    <th className="px-2 py-1.5 text-left">Vigência</th>
                    <th className="px-2 py-1.5 text-left">Taxa Inst.</th>
                    <th className="px-2 py-1.5 text-left">Bloco IP</th>
                    <th className="px-2 py-1.5 text-left">Tipo Sol.</th>
                    <th className="px-2 py-1.5 text-left">Vlr Venda</th>
                    <th className="px-2 py-1.5 text-left">Cód. Smark</th>
                    <th className="px-2 py-1.5 text-left">Observações (Sistema)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r, i) => {
                    const dbRow = dbRows[r.item.id];
                    const coords = r.geo_lat != null && r.geo_lng != null ? `${r.geo_lat}, ${r.geo_lng}` : "";
                    return (
                      <tr key={i} className={`border-t ${r.is_viable ? "" : r.is_check_om ? "bg-yellow-50 dark:bg-yellow-900/10" : "bg-destructive/5"}`}>
                        {!processing && isComplete && (
                      <td className={`px-2 py-1 text-center sticky left-0 z-10 ${r.is_viable ? "bg-background" : r.is_check_om ? "bg-yellow-50 dark:bg-yellow-900/10" : "bg-red-50 dark:bg-red-950"}`}>
                            <SelectionCheckbox
                              id={r.item.id}
                              checked={selectedIds.has(r.item.id)}
                              onToggle={toggleSelect}
                              inCart={isInCart(r.item.id)}
                              sent={isSent(r.item.id)}
                            />
                          </td>
                        )}
                        <td className={`px-2 py-1 sticky ${!processing && isComplete ? 'left-[32px]' : 'left-0'} z-10 ${r.is_viable ? "bg-background" : r.is_check_om ? "bg-yellow-50 dark:bg-yellow-900/10" : "bg-red-50 dark:bg-red-950"}`}>{r.item.row_number}</td>
                        <td className="px-2 py-1 max-w-[100px] truncate">{r.item.designacao || "—"}</td>
                        <td className="px-2 py-1 max-w-[100px] truncate">{r.item.cliente || "—"}</td>
                        {/* CNPJ - editable */}
                        <td className="px-1 py-0.5">
                          <InlineEdit value={dbRow?.cnpj_cliente || ""} onSave={(v) => updateInlineField(r.item.id, "cnpj_cliente", v)} width="w-[120px]" />
                        </td>
                        <td className="px-2 py-1">{r.item.velocidade_mbps ?? "—"}</td>
                        <td className="px-2 py-1 max-w-[160px] truncate">{r.item.endereco_a || "—"}</td>
                        {/* Coordenadas */}
                        <td className="px-2 py-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="max-w-[90px] truncate block text-[10px]">{coords || "—"}</span>
                            </TooltipTrigger>
                            {coords && <TooltipContent className="text-xs">{coords}</TooltipContent>}
                          </Tooltip>
                        </td>
                        <td className="px-2 py-1">
                          {r.geo_source === "coordenada" ? "📍" : r.geo_source === "endereco" ? "🔍" : "❌"}
                        </td>
                        <td className="px-2 py-1">
                          {r.is_viable ? (
                            <Badge className="text-[10px] px-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">SIM</Badge>
                          ) : r.is_check_om ? (
                            <Badge variant="outline" className="text-[10px] px-1 border-yellow-400 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 whitespace-nowrap">Checar O&M</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1 text-destructive">NÃO</Badge>
                          )}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">{r.stage || "—"}</td>
                        <td className="px-2 py-1 max-w-[100px] truncate">{r.provider_name || "—"}</td>
                        {/* Produto - dropdown */}
                        <td className="px-1 py-0.5">
                          <Select value={dbRow?.produto || "NT LINK DEDICADO FULL"} onValueChange={(v) => updateInlineField(r.item.id, "produto", v)}>
                            <SelectTrigger className="h-6 text-[10px] w-[130px] border-dashed">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRODUTO_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Tecnologia - dropdown */}
                        <td className="px-1 py-0.5">
                          <Select value={dbRow?.tecnologia || "GPON"} onValueChange={(v) => updateInlineField(r.item.id, "tecnologia", v)}>
                            <SelectTrigger className="h-6 text-[10px] w-[80px] border-dashed">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TECNOLOGIA_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Meio Físico - dropdown */}
                        <td className="px-1 py-0.5">
                          <Select value={dbRow?.tecnologia_meio_fisico || "Fibra"} onValueChange={(v) => updateInlineField(r.item.id, "tecnologia_meio_fisico", v)}>
                            <SelectTrigger className="h-6 text-[10px] w-[70px] border-dashed">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MEIO_FISICO_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1 min-w-[200px]">
                          <div className="relative">
                            <Textarea
                              className="text-[10px] min-h-[40px] h-10 resize-y"
                              value={editingObs[r.item.id] ?? ""}
                              onChange={(e) => handleObsChange(r.item.id, e.target.value)}
                              placeholder="Observação do usuário..."
                            />
                            {savingObs[r.item.id] && (
                              <Save className="absolute top-1 right-1 h-3 w-3 text-muted-foreground animate-pulse" />
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          {r.stage === "Rede Própria" && r.distance_m != null ? r.distance_m : "—"}
                        </td>
                        {/* Valor - editable */}
                        <td className="px-1 py-0.5">
                          <InlineEdit value={dbRow?.result_value != null ? String(dbRow.result_value) : (r.final_value != null ? String(r.final_value) : "")} type="number" onSave={(v) => updateInlineField(r.item.id, "result_value", v ? parseFloat(v) : null)} width="w-[70px]" />
                        </td>
                        {/* Vigência - dropdown */}
                        <td className="px-1 py-0.5">
                          <Select value={dbRow?.vigencia || ""} onValueChange={(v) => updateInlineField(r.item.id, "vigencia", v)}>
                            <SelectTrigger className="h-6 text-[10px] w-[80px] border-dashed">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {VIGENCIA_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Taxa Inst. - editable */}
                        <td className="px-1 py-0.5">
                          <InlineEdit value={dbRow?.taxa_instalacao != null ? String(dbRow.taxa_instalacao) : ""} type="number" onSave={(v) => updateInlineField(r.item.id, "taxa_instalacao", v !== "" ? parseFloat(v) : null)} width="w-[70px]" />
                        </td>
                        {/* Bloco IP - dropdown */}
                        <td className="px-1 py-0.5">
                          <Select value={dbRow?.bloco_ip || ""} onValueChange={(v) => updateInlineField(r.item.id, "bloco_ip", v)}>
                            <SelectTrigger className="h-6 text-[10px] w-[110px] border-dashed">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {BLOCO_IP_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Tipo Sol. - dropdown */}
                        <td className="px-1 py-0.5">
                          <Select value={dbRow?.tipo_solicitacao || ""} onValueChange={(v) => updateInlineField(r.item.id, "tipo_solicitacao", v)}>
                            <SelectTrigger className="h-6 text-[10px] w-[130px] border-dashed">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIPO_SOLICITACAO_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Vlr Venda - editable */}
                        <td className="px-1 py-0.5">
                          <InlineEdit value={dbRow?.valor_a_ser_vendido != null ? String(dbRow.valor_a_ser_vendido) : ""} type="number" onSave={(v) => updateInlineField(r.item.id, "valor_a_ser_vendido", v ? parseFloat(v) : null)} width="w-[80px]" />
                        </td>
                        {/* Cód. Smark - editable */}
                        <td className="px-1 py-0.5">
                          <InlineEdit value={dbRow?.codigo_smark || ""} onSave={(v) => updateInlineField(r.item.id, "codigo_smark", v)} width="w-[80px]" />
                        </td>
                        <td className="px-2 py-1 max-w-[200px] truncate text-muted-foreground">
                          {dbRow?.observacoes_system || r.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollableTable>}

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

        {/* Floating Action Bar for selection */}
        {!processing && isComplete && (
          <FloatingActionBar
            selectedIds={selectedIds}
            onToggle={toggleSelect}
            onToggleAll={toggleAll}
            allSelected={allSelected}
            buildCartItems={buildCartItems}
          />
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
