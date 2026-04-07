import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GeoGridPasta {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  ativo: string;
}

export interface GeoGridItemRede {
  id: string;
  sigla: string;
  pasta: string;
  siglaRecipiente: string;
  siglaPoste: string;
  valor: string;
  tipo: string;
  quantidadePortasEntrada: number;
  quantidadePortas: number;
  totalPortasReservadas: number;
  portasReservadasCliente: number;
  portasAtendimentoCliente: number;
  portasOcupadas: number;
  portasLivres: number;
  latitude: number | null;
  longitude: number | null;
}

async function callGeoGridProxy(endpoint: string, params?: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("geogrid-proxy", {
    body: { endpoint, params },
  });
  if (error) throw new Error(error.message || "Erro ao chamar GeoGrid");
  if (!data?.ok) throw new Error(`GeoGrid retornou status ${data?.status}`);
  return data?.data;
}

function safeStr(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object" && val.nome) return String(val.nome);
  if (typeof val === "object" && val.sigla) return String(val.sigla);
  if (typeof val === "object" && val.descricao) return String(val.descricao);
  return JSON.stringify(val);
}

function formatValor(raw: any): string {
  if (raw == null || raw === "") return "R$0,00";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") {
    return raw.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return String(raw);
}

function parseItemRede(raw: any): GeoGridItemRede {
  return {
    id: String(raw.id ?? raw.idItemRede ?? ""),
    sigla: safeStr(raw.sigla ?? raw.nome),
    pasta: safeStr(raw.pasta ?? raw.nomePasta),
    siglaRecipiente: safeStr(raw.siglaRecipiente ?? raw.recipiente),
    siglaPoste: safeStr(raw.siglaPoste ?? raw.poste),
    valor: formatValor(raw.valor ?? raw.valorEquipamento ?? raw.value),
    tipo: safeStr(raw.tipo ?? raw.tipoEquipamento ?? raw.descricaoEquipamento),
    quantidadePortasEntrada: Number(raw.quantidadePortasEntrada ?? raw.qtdPortasEntrada ?? 0),
    quantidadePortas: Number(raw.quantidadePortas ?? raw.qtdPortas ?? 0),
    totalPortasReservadas: Number(raw.totalPortasReservadas ?? raw.qtdPortasReservadas ?? 0),
    portasReservadasCliente: Number(raw.portasReservadasCliente ?? raw.qtdPortasReservadasCliente ?? 0),
    portasAtendimentoCliente: Number(raw.portasAtendimentoCliente ?? raw.qtdPortasAtendimentoCliente ?? 0),
    portasOcupadas: Number(raw.portasOcupadas ?? raw.qtdPortasOcupadas ?? 0),
    portasLivres: Number(raw.portasLivres ?? raw.qtdPortasLivres ?? 0),
    latitude: raw.latitude ? Number(String(raw.latitude).replace(",", ".")) : null,
    longitude: raw.longitude ? Number(String(raw.longitude).replace(",", ".")) : null,
  };
}

export function useGeoGridPastas() {
  const [pastas, setPastas] = useState<GeoGridPasta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPastas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callGeoGridProxy("pastas");
      const registros = result?.registros ?? result ?? [];
      const parsed: GeoGridPasta[] = (Array.isArray(registros) ? registros : []).map((r: any) => ({
        id: String(r.id),
        nome: typeof r.nome === "string" ? r.nome : (r.nome?.nome ?? JSON.stringify(r.nome) ?? ""),
        cidade: typeof r.cidade === "string" ? r.cidade : null,
        estado: typeof r.estado === "string" ? r.estado : null,
        ativo: typeof r.ativo === "string" ? r.ativo : "S",
      }));
      setPastas(parsed.filter((p) => p.ativo === "S"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { pastas, loading, error, fetchPastas };
}

export interface GeoGridViabilidadeItem {
  id: string;
  sigla: string;
  portasLivres: number;
  latitude: number | null;
  longitude: number | null;
  statusViabilidade: string;
  item: string;
  portas: number;
  portasOcupadas: number;
  fibras: number;
  fibrasLivres: number;
  fibrasOcupadas: number;
  // Enriched from /itensRede/{id}/mapa
  recipienteId: string;
  recipienteItem: string;
  recipienteSigla: string;
  pastaNome: string;
  tipoSplitter: string;
}

function parseViabilidadeItem(raw: any): GeoGridViabilidadeItem {
  return {
    id: String(raw.id ?? ""),
    sigla: safeStr(raw.sigla),
    portasLivres: Number(raw.portasLivres ?? 0),
    latitude: raw.latitude ? Number(String(raw.latitude).replace(",", ".")) : null,
    longitude: raw.longitude ? Number(String(raw.longitude).replace(",", ".")) : null,
    statusViabilidade: safeStr(raw.statusViabilidade),
    item: safeStr(raw.item),
    portas: Number(raw.portas ?? 0),
    portasOcupadas: Number(raw.portasOcupadas ?? 0),
    fibras: Number(raw.fibras ?? 0),
    fibrasLivres: Number(raw.fibrasLivres ?? 0),
    fibrasOcupadas: Number(raw.fibrasOcupadas ?? 0),
    recipienteId: "",
    recipienteItem: "",
    recipienteSigla: "",
    pastaNome: "",
    tipoSplitter: "",
  };
}

export function useGeoGridViabilidade() {
  const [items, setItems] = useState<GeoGridViabilidadeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [syncStats, setSyncStats] = useState<{ added: number; removed: number; updated: number } | null>(null);

  // Load persisted data from DB on mount
  const loadFromDb = useCallback(async () => {
    try {
      // Paginate to avoid the 1000-row default limit
      let allData: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error: dbErr } = await supabase
          .from("geogrid_viabilidade_cache")
          .select("*")
          .order("sigla")
          .range(from, from + PAGE - 1);
        if (dbErr) throw dbErr;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      if (allData.length > 0) {
        const mapped: GeoGridViabilidadeItem[] = allData
          .map((row: any) => ({
            id: row.geogrid_id,
            sigla: row.sigla,
            portasLivres: row.portas_livres,
            latitude: row.latitude ? Number(row.latitude) : null,
            longitude: row.longitude ? Number(row.longitude) : null,
            statusViabilidade: row.status_viabilidade,
            item: row.item,
            portas: row.portas,
            portasOcupadas: row.portas_ocupadas,
            fibras: row.fibras,
            fibrasLivres: row.fibras_livres,
            fibrasOcupadas: row.fibras_ocupadas,
            recipienteId: row.recipiente_id,
            recipienteItem: row.recipiente_item,
            recipienteSigla: row.recipiente_sigla,
            pastaNome: row.pasta_nome,
            tipoSplitter: row.tipo_splitter ?? "",
          }))
          .filter((item) => !!item.tipoSplitter);
        setItems(mapped);
      }
    } catch {
      // Silently fail — user can click refresh
    } finally {
      setDbLoaded(true);
    }
  }, []);

  // Upsert a single item to DB
  const upsertItemToDb = useCallback(async (item: GeoGridViabilidadeItem) => {
    try {
      // Check if exists
      const { data: existing } = await supabase
        .from("geogrid_viabilidade_cache")
        .select("id")
        .eq("geogrid_id", item.id)
        .maybeSingle();

      const row = {
        geogrid_id: item.id,
        sigla: item.sigla,
        portas_livres: item.portasLivres,
        latitude: item.latitude,
        longitude: item.longitude,
        status_viabilidade: item.statusViabilidade,
        item: item.item,
        portas: item.portas,
        portas_ocupadas: item.portasOcupadas,
        fibras: item.fibras,
        fibras_livres: item.fibrasLivres,
        fibras_ocupadas: item.fibrasOcupadas,
        recipiente_id: item.recipienteId,
        recipiente_item: item.recipienteItem,
        recipiente_sigla: item.recipienteSigla,
        pasta_nome: item.pastaNome,
        tipo_splitter: item.tipoSplitter,
        enriched: !!(item.recipienteId || item.pastaNome),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("geogrid_viabilidade_cache").update(row).eq("id", existing.id);
      } else {
        await supabase.from("geogrid_viabilidade_cache").insert(row);
      }
    } catch {
      // Silently fail on individual save
    }
  }, []);

  // Load from DB on mount
  useEffect(() => { loadFromDb(); }, [loadFromDb]);

  const fetchViabilidade = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSyncStats(null);
    try {
      const result = await callGeoGridProxy("viabilidade");
      const registros = result?.registros ?? result ?? [];
      const list = Array.isArray(registros) ? registros : [];
      const parsed = list.map(parseViabilidadeItem);
      const filtered = parsed.filter(
        (i) => i.portasLivres > 0 && i.statusViabilidade.toLowerCase() === "possui"
      );

      // Load existing DB items for diff
      const { data: dbItems } = await supabase
        .from("geogrid_viabilidade_cache")
        .select("geogrid_id");
      const existingDbIds = (dbItems ?? []).map((r: any) => r.geogrid_id as string);
      const newBaseIds = new Set(filtered.map((i) => i.id));

      // Extract base ID from composite IDs (e.g. "123_456" -> "123")
      const getBaseId = (id: string) => id.includes("_") ? id.split("_")[0] : id;

      // Remove items whose BASE id is no longer present in API
      const removedIds = existingDbIds.filter((id) => !newBaseIds.has(getBaseId(id)));
      if (removedIds.length > 0) {
        for (let b = 0; b < removedIds.length; b += 50) {
          await supabase
            .from("geogrid_viabilidade_cache")
            .delete()
            .in("geogrid_id", removedIds.slice(b, b + 50));
        }
      }

      const existingBaseIds = new Set(existingDbIds.map(getBaseId));
      const addedCount = [...newBaseIds].filter((id) => !existingBaseIds.has(id)).length;

      // Save base data for all items immediately (without enrichment)
      setItems(filtered);
      for (let b = 0; b < filtered.length; b += 50) {
        const batch = filtered.slice(b, b + 50);
        await Promise.all(batch.map((item) => upsertItemToDb(item)));
      }

      // Enrich with /itensRede/{id}/mapa + /pastas
      if (filtered.length > 0) {
        setEnriching(true);
        setEnrichProgress({ done: 0, total: filtered.length });

        // Fetch pastas once for name lookup
        let pastasMap: Record<string, string> = {};
        try {
          const pastasResult = await callGeoGridProxy("pastas");
          const pastasReg = pastasResult?.registros ?? pastasResult ?? [];
          const pastasList = Array.isArray(pastasReg) ? pastasReg : [];
          pastasMap = Object.fromEntries(
            pastasList.map((p: any) => [String(p.id), typeof p.nome === "string" ? p.nome : safeStr(p.nome)])
          );
        } catch { /* ignore pasta fetch errors */ }

        // Process one at a time with 1s delay between calls
        // For each item, get ALL recipients and create separate rows for each with available ports
        let finalItems: GeoGridViabilidadeItem[] = [];
        let updatedCount = 0;
        let processedCount = 0;
        setEnrichProgress({ done: 0, total: filtered.length });

        for (let i = 0; i < filtered.length; i++) {
          if (i > 0) {
            await new Promise((r) => setTimeout(r, 300));
          }
          const baseItem = filtered[i];
          try {
            const mapaResult = await callGeoGridProxy(`itensRede/${baseItem.id}/mapa`);
            const mapaData = mapaResult?.registros ?? mapaResult;

            const recipientes = mapaData?.recipientes ?? mapaData?.recipiente ?? [];
            const recipientesList = Array.isArray(recipientes) ? recipientes : (recipientes ? [recipientes] : []);

            const idPasta = String(mapaData?.idPasta ?? mapaData?.pasta?.id ?? "");
            const pastaNome = (idPasta && pastasMap[idPasta]) ? pastasMap[idPasta] : "";

            if (recipientesList.length === 0) {
              // No recipients — keep base item as-is
              finalItems.push({ ...baseItem, pastaNome });
              await upsertItemToDb({ ...baseItem, pastaNome });
              updatedCount++;
            } else {
              // Check each recipient for available ports
              for (let r = 0; r < recipientesList.length; r++) {
                const recip = recipientesList[r];
                const recipId = String(recip.id ?? "");
                const recipItem = safeStr(recip.item);
                const recipSigla = safeStr(recip.sigla);

                if (!recipId) continue;

                await new Promise((resolve) => setTimeout(resolve, 300));

                try {
                  const portasResult = await callGeoGridProxy(`viabilidade/${recipId}/portas`, { disponivel: "S" });
                  const portasReg = portasResult?.registros ?? portasResult ?? [];
                  const portasList = Array.isArray(portasReg) ? portasReg : [];

                  // Skip this recipient if no available ports
                  if (portasList.length === 0) continue;

                  // Extract splitter type
                  let tipoSplitter = "";
                  for (const porta of portasList) {
                    const siglaEquip = safeStr(porta?.equipamento?.sigla ?? porta?.equipamento);
                    const match = siglaEquip.match(/Spl\s+\d+x\d+\s+(Bal|Des)/i);
                    if (match) {
                      tipoSplitter = match[0];
                      break;
                    }
                  }

                  // Skip rows without a valid splitter type
                  if (!tipoSplitter) continue;

                  const enrichedItem: GeoGridViabilidadeItem = {
                    ...baseItem,
                    // Use a composite ID so multiple rows from the same base item don't collide
                    id: recipientesList.length > 1 ? `${baseItem.id}_${recipId}` : baseItem.id,
                    recipienteId: recipId,
                    recipienteItem: recipItem,
                    recipienteSigla: recipSigla,
                    pastaNome,
                    tipoSplitter,
                  };

                  finalItems.push(enrichedItem);
                  await upsertItemToDb(enrichedItem);
                  updatedCount++;
                } catch { /* skip this recipient on error */ }
              }
            }
          } catch {
            // On mapa fetch failure, keep base item
            finalItems.push(baseItem);
          }
          processedCount++;
          setEnrichProgress({ done: processedCount, total: filtered.length });
          setItems([...finalItems]);
        }
        setEnriching(false);
        setSyncStats({ added: addedCount, removed: removedIds.length, updated: updatedCount });
      } else {
        // No items — clear DB
        await supabase.from("geogrid_viabilidade_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        setSyncStats({ added: 0, removed: removedIds.length, updated: 0 });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [upsertItemToDb]);

  return { items, loading, enriching, enrichProgress, error, dbLoaded, syncStats, fetchViabilidade };
}

export function useGeoGridItensRede() {
  const [items, setItems] = useState<GeoGridItemRede[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);

  const fetchItensRede = useCallback(async (params?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    setRawResponse(null);
    try {
      const result = await callGeoGridProxy("itensRede", params);
      setRawResponse(result);
      const registros = result?.registros ?? result ?? [];
      const list = Array.isArray(registros) ? registros : [];
      setItems(list.map(parseItemRede));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { items, loading, error, rawResponse, fetchItensRede };
}
