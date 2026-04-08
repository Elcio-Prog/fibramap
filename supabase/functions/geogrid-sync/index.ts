import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function safeStr(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object" && val.nome) return String(val.nome);
  if (typeof val === "object" && val.sigla) return String(val.sigla);
  if (typeof val === "object" && val.descricao) return String(val.descricao);
  return JSON.stringify(val);
}

async function callGeoGrid(baseUrl: string, apiKey: string, endpoint: string, params?: Record<string, any>) {
  const url = new URL(`${baseUrl}/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString(), {
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`GeoGrid ${endpoint} returned ${res.status}`);
  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const GEOGRID_API_KEY = Deno.env.get('GEOGRID_API_KEY');
  const GEOGRID_BASE_URL = Deno.env.get('GEOGRID_BASE_URL');
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  if (!GEOGRID_API_KEY || !GEOGRID_BASE_URL) {
    return new Response(JSON.stringify({ error: 'GeoGrid credentials not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = GEOGRID_BASE_URL.startsWith('http') ? GEOGRID_BASE_URL : `https://${GEOGRID_BASE_URL}`;

  try {
    console.log("Starting GeoGrid sync...");

    // 1. Fetch viabilidade
    const viabResult = await callGeoGrid(baseUrl, GEOGRID_API_KEY, "viabilidade");
    const registros = viabResult?.registros ?? viabResult ?? [];
    const list = Array.isArray(registros) ? registros : [];

    const filtered = list
      .map((raw: any) => ({
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
      }))
      .filter((i: any) => i.portasLivres > 0 && i.statusViabilidade.toLowerCase() !== "sem");

    console.log(`Fetched ${filtered.length} items with available ports`);

    // 2. Load existing DB IDs
    let existingDbIds: string[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabaseAdmin
        .from("geogrid_viabilidade_cache")
        .select("geogrid_id")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      existingDbIds = existingDbIds.concat(data.map((r: any) => r.geogrid_id));
      if (data.length < 1000) break;
      from += 1000;
    }

    const newBaseIds = new Set(filtered.map((i: any) => i.id));
    const getBaseId = (id: string) => id.includes("_") ? id.split("_")[0] : id;

    // 3. Remove stale items
    const removedIds = existingDbIds.filter((id) => !newBaseIds.has(getBaseId(id)));
    for (let b = 0; b < removedIds.length; b += 50) {
      await supabaseAdmin
        .from("geogrid_viabilidade_cache")
        .delete()
        .in("geogrid_id", removedIds.slice(b, b + 50));
    }

    // 4. Fetch pastas for name lookup
    let pastasMap: Record<string, string> = {};
    try {
      const pastasResult = await callGeoGrid(baseUrl, GEOGRID_API_KEY, "pastas");
      const pastasReg = pastasResult?.registros ?? pastasResult ?? [];
      const pastasList = Array.isArray(pastasReg) ? pastasReg : [];
      pastasMap = Object.fromEntries(
        pastasList.map((p: any) => [String(p.id), typeof p.nome === "string" ? p.nome : safeStr(p.nome)])
      );
    } catch { /* ignore */ }

    // 5. Enrich each item
    let totalUpserted = 0;
    for (let i = 0; i < filtered.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 300));
      const baseItem = filtered[i];

      try {
        const mapaResult = await callGeoGrid(baseUrl, GEOGRID_API_KEY, `itensRede/${baseItem.id}/mapa`);
        const mapaData = mapaResult?.registros ?? mapaResult;
        const recipientes = mapaData?.recipientes ?? mapaData?.recipiente ?? [];
        const recipientesList = Array.isArray(recipientes) ? recipientes : (recipientes ? [recipientes] : []);
        const idPasta = String(mapaData?.idPasta ?? mapaData?.pasta?.id ?? "");
        const pastaNome = (idPasta && pastasMap[idPasta]) ? pastasMap[idPasta] : "";

        if (recipientesList.length === 0) {
          await upsertRow(supabaseAdmin, { ...baseItem, recipienteId: "", recipienteItem: "", recipienteSigla: "", pastaNome, tipoSplitter: "" });
          totalUpserted++;
        } else {
          for (const recip of recipientesList) {
            const recipId = String(recip.id ?? "");
            if (!recipId) continue;
            await new Promise((r) => setTimeout(r, 300));
            try {
              const portasResult = await callGeoGrid(baseUrl, GEOGRID_API_KEY, `viabilidade/${recipId}/portas`, { disponivel: "S" });
              const portasReg = portasResult?.registros ?? portasResult ?? [];
              const portasList = Array.isArray(portasReg) ? portasReg : [];
              if (portasList.length === 0) continue;

              let tipoSplitter = "";
              for (const porta of portasList) {
                const siglaEquip = safeStr(porta?.equipamento?.sigla ?? porta?.equipamento);
                const match = siglaEquip.match(/Spl\s+\d+x\d+\s+(Bal|Des)/i);
                if (match) { tipoSplitter = match[0]; break; }
              }
              if (!tipoSplitter) continue;

              const compositeId = recipientesList.length > 1 ? `${baseItem.id}_${recipId}` : baseItem.id;
              await upsertRow(supabaseAdmin, {
                ...baseItem, id: compositeId,
                recipienteId: recipId, recipienteItem: safeStr(recip.item),
                recipienteSigla: safeStr(recip.sigla), pastaNome, tipoSplitter,
              });
              totalUpserted++;
            } catch { /* skip */ }
          }
        }
      } catch { /* skip */ }

      if ((i + 1) % 50 === 0) console.log(`Progress: ${i + 1}/${filtered.length}`);
    }

    // 6. Save last sync timestamp
    const now = new Date().toISOString();
    const { data: existing } = await supabaseAdmin
      .from("configuracoes")
      .select("id")
      .eq("chave", "geogrid_last_sync")
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from("configuracoes").update({ valor: JSON.stringify(now), updated_at: now }).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("configuracoes").insert({ chave: "geogrid_last_sync", valor: JSON.stringify(now) });
    }

    console.log(`GeoGrid sync complete. Upserted: ${totalUpserted}, Removed: ${removedIds.length}`);

    return new Response(JSON.stringify({
      success: true,
      upserted: totalUpserted,
      removed: removedIds.length,
      total_fetched: filtered.length,
      synced_at: now,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("GeoGrid sync error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function upsertRow(supabase: any, item: any) {
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

  const { data: existing } = await supabase
    .from("geogrid_viabilidade_cache")
    .select("id")
    .eq("geogrid_id", item.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("geogrid_viabilidade_cache").update(row).eq("id", existing.id);
  } else {
    await supabase.from("geogrid_viabilidade_cache").insert(row);
  }
}
