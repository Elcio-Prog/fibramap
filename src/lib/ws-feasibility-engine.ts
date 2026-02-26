/**
 * Motor de viabilidade WS reutilizável.
 * Extrai a lógica de FeasibilityPage para uso em batch.
 */
import {
  geocodeAddress,
  findNearestPoint,
  findBestConnectionPoint,
  findBestConnectionPointByRoute,
  getRouteDistance,
  isInsideCoverage,
  findNearestBoundaryPoint,
  routeCrossesCPFL,
  checkRouteHighwayRailway,
  type TAResult,
  type ProviderRules,
} from "@/lib/geo-utils";

export interface WsItemInput {
  id: string;
  designacao?: string | null;
  cliente?: string | null;
  tipo_link?: string | null;
  velocidade_mbps?: number | null;
  endereco_a?: string | null;
  cidade_a?: string | null;
  uf_a?: string | null;
  lat_a?: number | null;
  lng_a?: number | null;
  endereco_b?: string | null;
  cidade_b?: string | null;
  uf_b?: string | null;
  lat_b?: number | null;
  lng_b?: number | null;
  prazo_ativacao?: string | null;
  is_l2l: boolean;
  l2l_suffix?: string | null;
  l2l_pair_id?: string | null;
  row_number: number;
}

export interface WsResult {
  item: WsItemInput;
  // Geo resolution
  geo_lat: number | null;
  geo_lng: number | null;
  geo_source: "coordenada" | "endereco" | "nao_encontrado";
  // Best result
  stage: string | null; // "Rede Própria" | "Dentro Cobertura" | "Cross NTT" | "LPU Viável" | "LM Histórico" | null
  provider_name: string | null;
  distance_m: number | null;
  lpu_value: number | null;
  final_value: number | null;
  is_viable: boolean;
  notes: string;
  ta_info?: string;
}

interface Provider {
  id: string;
  name: string;
  color: string;
  multiplier: number;
  max_lpu_distance_m: number;
  has_cross_ntt: boolean;
  regras_usar_porta_disponivel: boolean;
  regras_considerar_ta: boolean;
  regras_considerar_ce: boolean;
  regras_bloquear_splitter_1x2: boolean;
  regras_bloquear_splitter_des: boolean;
  regras_bloquear_portas_livres_zero: boolean;
  regras_bloquear_atendimento_nao_sim: boolean;
  regras_habilitar_exclusao_cpfl: boolean;
  use_saturated_ta: boolean;
}

interface GeoElement {
  geometry: any;
  provider_id: string;
  properties: any;
  element_type: string;
}

interface LpuItem {
  provider_id: string;
  link_type: string;
  value: number;
}

interface CompraLM {
  endereco: string;
  lat: number | null;
  lng: number | null;
  banda_mbps: number | null;
  parceiro: string;
  valor_mensal: number;
  status: string;
}

export interface ProcessingProgress {
  current: number;
  total: number;
  currentItem?: string;
}

/**
 * Resolve coordenadas para um item WS.
 * Prioriza coordenadas, depois geocode por endereço.
 */
async function resolveGeo(item: WsItemInput): Promise<{
  lat: number | null;
  lng: number | null;
  source: "coordenada" | "endereco" | "nao_encontrado";
}> {
  // 1. Coordenadas diretas
  if (item.lat_a != null && item.lng_a != null) {
    return { lat: item.lat_a, lng: item.lng_a, source: "coordenada" };
  }

  // 2. Geocode pelo endereço
  if (item.endereco_a) {
    try {
      const result = await geocodeAddress(item.endereco_a);
      if (result) {
        return { lat: result.lat, lng: result.lng, source: "endereco" };
      }
    } catch {
      // fallback
    }
  }

  return { lat: null, lng: null, source: "nao_encontrado" };
}

/**
 * Processa um item contra todos provedores.
 * Pipeline: Rede Própria → Dentro Cobertura → Cross/LPU → LM Histórico
 */
async function processItem(
  item: WsItemInput,
  lat: number,
  lng: number,
  providers: Provider[],
  elementsByProvider: Record<string, GeoElement[]>,
  lpuItems: LpuItem[],
  comprasLM: CompraLM[],
): Promise<Omit<WsResult, "item" | "geo_lat" | "geo_lng" | "geo_source">> {
  const netTurboProvider = providers.find(p => p.name.toLowerCase().includes("net turbo"));

  // === Etapa 1: Rede Própria NTT ===
  if (netTurboProvider) {
    const elements = elementsByProvider[netTurboProvider.id] || [];
    if (elements.length > 0) {
      const rules: ProviderRules = {
        regras_usar_porta_disponivel: netTurboProvider.regras_usar_porta_disponivel,
        regras_considerar_ta: netTurboProvider.regras_considerar_ta,
        regras_considerar_ce: netTurboProvider.regras_considerar_ce,
        regras_bloquear_splitter_1x2: netTurboProvider.regras_bloquear_splitter_1x2,
        regras_bloquear_splitter_des: netTurboProvider.regras_bloquear_splitter_des,
        regras_bloquear_portas_livres_zero: netTurboProvider.regras_bloquear_portas_livres_zero,
        regras_bloquear_atendimento_nao_sim: netTurboProvider.regras_bloquear_atendimento_nao_sim,
        regras_habilitar_exclusao_cpfl: netTurboProvider.regras_habilitar_exclusao_cpfl,
      };

      const inside = isInsideCoverage(lat, lng, elements);
      const elMapped = elements.map(e => ({ geometry: e.geometry, provider_id: e.provider_id, properties: e.properties }));

      if (inside) {
        const cp = findBestConnectionPoint(lat, lng, elMapped, netTurboProvider.max_lpu_distance_m, rules);
        const taNote = cp ? `${cp.tipo}: ${cp.nome} | ${cp.aptoNovoCliente ? "Apto" : "Não apto"}` : "";
        return {
          stage: "Rede Própria",
          provider_name: netTurboProvider.name,
          distance_m: 0,
          lpu_value: null,
          final_value: null,
          is_viable: true,
          notes: `Dentro da cobertura NTT. ${taNote}`,
          ta_info: taNote,
        };
      }

      // Outside but check route (try next candidates automatically when blocked)
      try {
        let lastBlockedMsg = "";
        const cpByRoute = await findBestConnectionPointByRoute(
          lat,
          lng,
          elMapped,
          netTurboProvider.max_lpu_distance_m,
          rules,
          Number.POSITIVE_INFINITY,
          async (_candidate, route) => {
            if (rules.regras_habilitar_exclusao_cpfl && route.geometry) {
              const cpflCheck = routeCrossesCPFL(route.geometry, elMapped);
              if (cpflCheck.crosses) {
                lastBlockedMsg = cpflCheck.message || "Cruzamento CPFL";
                return false;
              }
            }

            if (route.geometry) {
              const hwCheck = await checkRouteHighwayRailway(route.geometry, elMapped);
              if (hwCheck.blocked) {
                lastBlockedMsg = hwCheck.message || "Cruzamento rodovia/ferrovia";
                return false;
              }
            }

            return true;
          }
        );

        if (cpByRoute && cpByRoute.routeDistance <= netTurboProvider.max_lpu_distance_m) {
          const taNote = `${cpByRoute.taResult.tipo}: ${cpByRoute.taResult.nome}`;
          return {
            stage: "Rede Própria",
            provider_name: netTurboProvider.name,
            distance_m: Math.round(cpByRoute.routeDistance),
            lpu_value: null,
            final_value: null,
            is_viable: true,
            notes: `Rede própria viável - ${Math.round(cpByRoute.routeDistance)}m. ${taNote}`,
            ta_info: taNote,
          };
        }

        // If all nearest candidates were blocked, continue to next stages (Cross/LPU/LM)
        if (lastBlockedMsg) {
          // blocked by rule, fallback to external stages
        }
      } catch {
        // Continue to next stages
      }
    }
  }

  // === Etapa 2: Rede Expandida (provedores com cobertura/Cross/LPU) ===
  type ProvResult = { provider: Provider; stage: string; distance: number; lpuValue: number; finalValue: number; notes: string };
  const provResults: ProvResult[] = [];

  for (const provider of providers) {
    if (provider.id === netTurboProvider?.id) continue;
    const elements = elementsByProvider[provider.id] || [];
    if (elements.length === 0) continue;

    const providerLpu = lpuItems.filter(l => l.provider_id === provider.id);
    const lpuItem = providerLpu.length > 0 ? providerLpu[0] : null;
    const lpuValue = lpuItem?.value || 0;
    const mult = provider.multiplier;
    const finalValue = mult > 0 ? lpuValue / mult : lpuValue;
    const maxDist = provider.max_lpu_distance_m;

    const inside = isInsideCoverage(lat, lng, elements);
    if (inside) {
      const stage = provider.has_cross_ntt ? "Cross NTT" : "Dentro Cobertura";
      provResults.push({
        provider,
        stage,
        distance: 0,
        lpuValue,
        finalValue: Math.round(finalValue * 100) / 100,
        notes: `${stage} - ${provider.name}`,
      });
      continue;
    }

    // Outside - check distance
    try {
      const nearest = findNearestBoundaryPoint(lat, lng, elements);
      if (!nearest) continue;
      const nearestAny = findNearestPoint(lat, lng, elements.map(e => ({ geometry: e.geometry, provider_id: e.provider_id, properties: e.properties })));
      const bestNearest = nearestAny && nearestAny.distance < nearest.distance ? nearestAny : nearest;

      let distance = bestNearest.distance;
      try {
        const route = await getRouteDistance(lat, lng, bestNearest.point[0], bestNearest.point[1]);
        if (route) distance = route.distance;
      } catch {}

      if (distance <= maxDist) {
        provResults.push({
          provider,
          stage: "LPU Viável",
          distance: Math.round(distance),
          lpuValue,
          finalValue: Math.round(finalValue * 100) / 100,
          notes: `LPU viável - ${provider.name} - ${Math.round(distance)}m`,
        });
      }
    } catch {
      // skip
    }
  }

  // Sort by priority: Cross NTT > Dentro Cobertura > LPU
  if (provResults.length > 0) {
    const stageOrder: Record<string, number> = { "Cross NTT": 0, "Dentro Cobertura": 1, "LPU Viável": 2 };
    provResults.sort((a, b) => (stageOrder[a.stage] ?? 9) - (stageOrder[b.stage] ?? 9) || a.distance - b.distance);
    const best = provResults[0];
    return {
      stage: best.stage,
      provider_name: best.provider.name,
      distance_m: best.distance,
      lpu_value: best.lpuValue,
      final_value: best.finalValue,
      is_viable: true,
      notes: best.notes,
    };
  }

  // === Etapa 3: LM Histórico (apenas ≤100 Mbps, raio 50km) ===
  if (item.velocidade_mbps != null && item.velocidade_mbps <= 100 && comprasLM.length > 0) {
    const RADIUS_KM = 50;
    let bestLM: CompraLM | null = null;
    let bestDist = Infinity;

    for (const lm of comprasLM) {
      if (lm.lat == null || lm.lng == null) continue;
      if (lm.status?.toUpperCase() !== "ATIVO") continue;
      // Haversine quick check
      const dLat = (lm.lat - lat) * 111.32;
      const dLng = (lm.lng - lng) * 111.32 * Math.cos(lat * Math.PI / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      if (dist <= RADIUS_KM && dist < bestDist) {
        bestDist = dist;
        bestLM = lm;
      }
    }

    if (bestLM) {
      return {
        stage: "LM Histórico",
        provider_name: bestLM.parceiro,
        distance_m: Math.round(bestDist * 1000),
        lpu_value: bestLM.valor_mensal,
        final_value: bestLM.valor_mensal,
        is_viable: true,
        notes: `LM Histórico - ${bestLM.parceiro} - ${bestDist.toFixed(1)}km - R$${bestLM.valor_mensal}`,
      };
    }
  }

  // Nenhuma viabilidade encontrada
  return {
    stage: null,
    provider_name: null,
    distance_m: null,
    lpu_value: null,
    final_value: null,
    is_viable: false,
    notes: "Sem viabilidade encontrada",
  };
}

/**
 * Processa um lote completo de itens WS.
 */
export async function processWsBatch(
  items: WsItemInput[],
  providers: Provider[],
  geoElements: GeoElement[],
  lpuItems: LpuItem[],
  comprasLM: CompraLM[],
  onProgress?: (progress: ProcessingProgress) => void,
): Promise<WsResult[]> {
  // Index elements by provider
  const elementsByProvider: Record<string, GeoElement[]> = {};
  for (const el of geoElements) {
    if (!elementsByProvider[el.provider_id]) elementsByProvider[el.provider_id] = [];
    elementsByProvider[el.provider_id].push(el);
  }

  const results: WsResult[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress?.({
      current: i + 1,
      total: items.length,
      currentItem: item.designacao || item.endereco_a || `Linha ${item.row_number}`,
    });

    // Resolve geo
    const geo = await resolveGeo(item);

    if (geo.lat == null || geo.lng == null) {
      results.push({
        item,
        geo_lat: null,
        geo_lng: null,
        geo_source: "nao_encontrado",
        stage: null,
        provider_name: null,
        distance_m: null,
        lpu_value: null,
        final_value: null,
        is_viable: false,
        notes: "Endereço/coordenada não encontrado",
      });
      continue;
    }

    const feasibility = await processItem(item, geo.lat, geo.lng, providers, elementsByProvider, lpuItems, comprasLM);

    results.push({
      item,
      geo_lat: geo.lat,
      geo_lng: geo.lng,
      geo_source: geo.source,
      ...feasibility,
    });

    // Rate limit geocoding - small delay between items to avoid API limits
    if (geo.source === "endereco") {
      await new Promise(r => setTimeout(r, 1100));
    }
  }

  return results;
}
