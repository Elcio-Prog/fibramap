/**
 * Motor de viabilidade WS reutilizável.
 * Extrai a lógica de FeasibilityPage para uso em batch.
 * Salva progresso item a item no banco para sobreviver a navegação.
 * Retorna TODAS as opções viáveis encontradas por item.
 */
import {
  geocodeAddress,
  findNearestPoint,
  findBestConnectionPoint,
  findBestConnectionPointByRoute,
  findNearestConnectionPointAny,
  getRouteDistance,
  isInsideCoverage,
  findNearestBoundaryPoint,
  routeCrossesCPFL,
  checkRouteHighwayRailwayWithCache,
  prefetchHighwaysForArea,
  extractNttCables,
  hasNetworkInRadius,
  type TAResult,
  type ProviderRules,
  type OverpassFetchResult,
} from "@/lib/geo-utils";
import { fetchCep } from "@/lib/cep-utils";
import { supabase } from "@/integrations/supabase/client";

export interface WsItemInput {
  id: string;
  designacao?: string | null;
  cliente?: string | null;
  tipo_link?: string | null;
  velocidade_mbps?: number | null;
  endereco_a?: string | null;
  cidade_a?: string | null;
  uf_a?: string | null;
  cep_a?: string | null;
  numero_a?: string | null;
  lat_a?: number | null;
  lng_a?: number | null;
  endereco_b?: string | null;
  cidade_b?: string | null;
  uf_b?: string | null;
  cep_b?: string | null;
  numero_b?: string | null;
  lat_b?: number | null;
  lng_b?: number | null;
  prazo_ativacao?: string | null;
  is_l2l: boolean;
  l2l_suffix?: string | null;
  l2l_pair_id?: string | null;
  row_number: number;
}

/** Uma opção viável encontrada */
export interface ViableOption {
  stage: string;
  provider_name: string;
  provider_id: string;
  provider_color: string;
  distance_m: number;
  lpu_value: number | null;
  final_value: number | null;
  notes: string;
  ta_info?: string;
  route_geometry?: any;
  nearest_point?: [number, number];
  is_own_network?: boolean;
  has_cross_ntt?: boolean;
  /** lat/lng of the snapped road point when origin is off-road */
  snap_point?: [number, number];
  /** lat/lng of the snapped road point when destination (box) is off-road */
  dest_snap_point?: [number, number];
  /** True when NTT was found nearby but blocked by technical rule (CPFL, highway, etc.) */
  is_blocked?: boolean;
  /** True when NTT box is nearby but unavailable — needs O&M check */
  is_check_om?: boolean;
}

export interface WsResult {
  item: WsItemInput;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_source: "coordenada" | "cep" | "endereco" | "nao_encontrado";
  // Best result
  stage: string | null;
  provider_name: string | null;
  distance_m: number | null;
  lpu_value: number | null;
  final_value: number | null;
  is_viable: boolean;
  is_check_om?: boolean;
  notes: string;
  ta_info?: string;
  // ALL viable options found
  all_options: ViableOption[];
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

export interface PreProviderWithCities {
  id: string;
  nome_fantasia: string;
  has_cross_ntt: boolean;
  cities: { cidade: string; estado: string | null }[];
}

export interface ProcessingProgress {
  current: number;
  total: number;
  currentItem?: string;
}

/**
 * Resolve coordenadas para um item WS.
 */
async function resolveGeo(item: WsItemInput): Promise<{
  lat: number | null;
  lng: number | null;
  source: "coordenada" | "cep" | "endereco" | "nao_encontrado";
}> {
  // 1) Coordenadas fornecidas na planilha
  if (item.lat_a != null && item.lng_a != null) {
    return { lat: item.lat_a, lng: item.lng_a, source: "coordenada" };
  }

  // 2) CEP + Número (via ViaCEP → Nominatim)
  if (item.cep_a) {
    try {
      const cepData = await fetchCep(item.cep_a);
      if (cepData) {
        // Build address from CEP data + optional number
        const parts = [cepData.logradouro];
        if (item.numero_a) parts.push(item.numero_a);
        parts.push(cepData.bairro, cepData.localidade, cepData.uf);
        const cepAddress = parts.filter(Boolean).join(", ");
        const result = await geocodeAddress(cepAddress);
        if (result) {
          return { lat: result.lat, lng: result.lng, source: "cep" };
        }
      }
    } catch {
      // fallback to address
    }
  }

  // 3) Endereço completo
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
 * Processa um item contra TODOS provedores e coleta TODAS opções viáveis.
 * Não faz early return - sempre verifica NTT, provedores expandidos e LM.
 */
async function processItem(
  item: WsItemInput,
  lat: number,
  lng: number,
  providers: Provider[],
  elementsByProvider: Record<string, GeoElement[]>,
  lpuItems: LpuItem[],
  comprasLM: CompraLM[],
  preProviders: PreProviderWithCities[] = [],
): Promise<{ best: Omit<WsResult, "item" | "geo_lat" | "geo_lng" | "geo_source" | "all_options">; all_options: ViableOption[] }> {
  const allOptions: ViableOption[] = [];
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
        regras_bloquear_cruzamento_rodovia: (netTurboProvider as any).regras_bloquear_cruzamento_rodovia ?? true,
      };

      const inside = isInsideCoverage(lat, lng, elements);
      const elMapped = elements.map(e => ({ geometry: e.geometry, provider_id: e.provider_id, properties: e.properties }));

      // Pre-fetch highways/railways ONCE for the customer area to avoid Overpass rate limiting
      const [overpassResult, nttCables] = await Promise.all([
        prefetchHighwaysForArea(lat, lng, netTurboProvider.max_lpu_distance_m + 1000),
        Promise.resolve(extractNttCables(elMapped)),
      ]);
      const cachedWays = overpassResult.ways;
      const overpassFailed = !overpassResult.success;
      const highwayVerificationPending = rules.regras_bloquear_cruzamento_rodovia && overpassFailed;

      if (inside) {
        const cp = findBestConnectionPoint(lat, lng, elMapped, netTurboProvider.max_lpu_distance_m, rules);
        const taNote = cp ? `${cp.tipo}: ${cp.nome} | ${cp.aptoNovoCliente ? "Apto" : "Não apto"}` : "";
        allOptions.push({
          stage: "Rede Própria",
          provider_name: netTurboProvider.name,
          provider_id: netTurboProvider.id,
          provider_color: netTurboProvider.color,
          distance_m: 0,
          lpu_value: null,
          final_value: null,
          notes: `Dentro da cobertura NTT. ${taNote}`,
          ta_info: taNote,
          nearest_point: cp?.point,
          is_own_network: true,
        });
      } else {
        // === FASE 1: Pré-verificação por raio ===
        // Verifica se QUALQUER elemento NTT (cabo, caixa, polígono) existe dentro de 5km.
        // Se sim, confirma presença de rede e habilita retries agressivos na Fase 2.
        const NTT_PRESCAN_RADIUS = 5000; // 5km
        const nttNetworkNearby = hasNetworkInRadius(lat, lng, elMapped, NTT_PRESCAN_RADIUS);
        const MAX_ATTEMPTS = nttNetworkNearby ? 3 : 1; // Retry agressivo se rede confirmada
        
        console.log(`[WS] NTT Phase 1: network within ${NTT_PRESCAN_RADIUS}m = ${nttNetworkNearby}. Will attempt up to ${MAX_ATTEMPTS} route searches.`);

        // === FASE 2: Busca detalhada por rota com retries ===
        try {
          let lastBlockedMsg = "";
          let cpByRoute: Awaited<ReturnType<typeof findBestConnectionPointByRoute>> = null;
          
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            if (attempt > 1) {
              // Wait before retry — give OSRM time to recover
              const delay = 1500 + (attempt - 1) * 1000; // 1.5s, 2.5s
              console.log(`[WS] NTT Phase 2: retry attempt ${attempt}/${MAX_ATTEMPTS} after ${delay}ms delay...`);
              await new Promise(r => setTimeout(r, delay));
            }
            
            lastBlockedMsg = "";
            cpByRoute = await findBestConnectionPointByRoute(
              lat,
              lng,
              elMapped,
              netTurboProvider.max_lpu_distance_m,
              rules,
              10,
              async (_candidate, route) => {
                if (rules.regras_habilitar_exclusao_cpfl && route.geometry) {
                  const cpflCheck = routeCrossesCPFL(route.geometry, elMapped);
                  if (cpflCheck.crosses) {
                    lastBlockedMsg = cpflCheck.message || "Cruzamento CPFL";
                    return false;
                  }
                }

                if (rules.regras_bloquear_cruzamento_rodovia && route.geometry && !highwayVerificationPending) {
                  const hwCheck = checkRouteHighwayRailwayWithCache(route.geometry, cachedWays, nttCables, overpassFailed);
                  if (hwCheck.blocked) {
                    lastBlockedMsg = hwCheck.message || "Cruzamento rodovia/ferrovia";
                    return false;
                  }
                }

                return true;
              }
            );

            // Se encontrou resultado viável (com rota real, não fallback), pode parar
            if (cpByRoute && cpByRoute.routeDistance <= netTurboProvider.max_lpu_distance_m && !cpByRoute.verificationPending) {
              console.log(`[WS] NTT Phase 2: found viable box on attempt ${attempt} at ${Math.round(cpByRoute.routeDistance)}m`);
              break;
            }
            
            // Se é a última tentativa e tem verificationPending, aceita o fallback
            if (attempt === MAX_ATTEMPTS) {
              console.log(`[WS] NTT Phase 2: exhausted ${MAX_ATTEMPTS} attempts. Using best available result.`);
            }
          }

          if (cpByRoute && cpByRoute.routeDistance <= netTurboProvider.max_lpu_distance_m) {
            const taNote = `${cpByRoute.taResult.tipo}: ${cpByRoute.taResult.nome}`;
            const verificationPending = !!cpByRoute.verificationPending || highwayVerificationPending;
            const pendingReasons = [
              cpByRoute.verificationPending ? "a validação automática de rota ficou indisponível nesta tentativa" : null,
              highwayVerificationPending ? "a verificação de cruzamento de rodovias/ferrovias ficou indisponível nesta tentativa" : null,
            ].filter(Boolean).join(" e ");
            const distanceLabel = cpByRoute.verificationPending
              ? `${Math.round(cpByRoute.routeDistance)}m em linha reta`
              : `${Math.round(cpByRoute.routeDistance)}m`;
            allOptions.push({
              stage: "Rede Própria",
              provider_name: netTurboProvider.name,
              provider_id: netTurboProvider.id,
              provider_color: netTurboProvider.color,
              distance_m: Math.round(cpByRoute.routeDistance),
              lpu_value: null,
              final_value: null,
              notes: verificationPending
                ? `Caixa/TA próxima encontrada a ${distanceLabel}, mas ${pendingReasons}. ${taNote}. Reprocessar/validar com O&M antes de tratar como inviável.`
                : `Rede própria viável - ${Math.round(cpByRoute.routeDistance)}m. ${taNote}`,
              ta_info: taNote,
              nearest_point: cpByRoute.taResult.point,
              route_geometry: cpByRoute.routeGeometry,
              snap_point: cpByRoute.snapPoint,
              dest_snap_point: cpByRoute.destSnapPoint,
              is_own_network: true,
              is_check_om: verificationPending,
            });
          } else if (lastBlockedMsg) {
            allOptions.push({
              stage: "Rede Própria",
              provider_name: netTurboProvider.name,
              provider_id: netTurboProvider.id,
              provider_color: netTurboProvider.color,
              distance_m: netTurboProvider.max_lpu_distance_m,
              lpu_value: null,
              final_value: null,
              notes: `Rede própria próxima, mas bloqueada por regra técnica: ${lastBlockedMsg}`,
              is_own_network: true,
              is_blocked: true,
            });
          } else {
            // Cenário 2: Não encontrou caixa apta — checar se existe caixa próxima indisponível
            const nearestAnyBox = findNearestConnectionPointAny(
              lat, lng, elMapped, netTurboProvider.max_lpu_distance_m
            );
            if (nearestAnyBox) {
              allOptions.push({
                stage: "Rede Própria",
                provider_name: netTurboProvider.name,
                provider_id: netTurboProvider.id,
                provider_color: netTurboProvider.color,
                distance_m: Math.round(nearestAnyBox.distance),
                lpu_value: null,
                final_value: null,
                notes: nttNetworkNearby
                  ? `Rede NTT confirmada na região (raio 5km), porém nenhuma caixa apta no raio técnico. Checar com O&M.`
                  : `Caixa próxima ao cliente, porém indisponível. Checar com O&M a disponibilidade da mesma.`,
                ta_info: `${nearestAnyBox.tipo}: ${nearestAnyBox.nome}`,
                nearest_point: nearestAnyBox.point,
                is_own_network: true,
                is_check_om: true,
              });
            } else if (nttNetworkNearby) {
              // Rede NTT confirmada no raio mas nenhuma caixa TA/CE encontrada
              allOptions.push({
                stage: "Rede Própria",
                provider_name: netTurboProvider.name,
                provider_id: netTurboProvider.id,
                provider_color: netTurboProvider.color,
                distance_m: netTurboProvider.max_lpu_distance_m,
                lpu_value: null,
                final_value: null,
                notes: `Rede NTT confirmada na região (raio 5km), mas nenhuma caixa (TA/CE) disponível no raio técnico de ${netTurboProvider.max_lpu_distance_m}m. Checar com O&M a possibilidade de expansão.`,
                is_own_network: true,
                is_check_om: true,
              });
            }
          }
        } catch (err) {
          console.warn("NTT route check failed:", err);
        }
      }
    }
  }

  // === Etapa 2: Rede Expandida (TODOS provedores) ===
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
      allOptions.push({
        stage,
        provider_name: provider.name,
        provider_id: provider.id,
        provider_color: provider.color,
        distance_m: 0,
        lpu_value: lpuValue,
        final_value: Math.round(finalValue * 100) / 100,
        notes: `${stage} - ${provider.name}`,
        has_cross_ntt: provider.has_cross_ntt,
      });
      continue;
    }

    try {
      const nearest = findNearestBoundaryPoint(lat, lng, elements);
      if (!nearest) continue;
      const nearestAny = findNearestPoint(lat, lng, elements.map(e => ({ geometry: e.geometry, provider_id: e.provider_id, properties: e.properties })));
      const bestNearest = nearestAny && nearestAny.distance < nearest.distance ? nearestAny : nearest;

      let distance = bestNearest.distance;
      let routeGeometry: any = null;
      let snapPoint: [number, number] | undefined = undefined;
      let destSnapPoint: [number, number] | undefined = undefined;
      try {
        const route = await getRouteDistance(lat, lng, bestNearest.point[0], bestNearest.point[1]);
        if (route) {
          distance = route.distance;
          routeGeometry = route.geometry;
          snapPoint = route.snapPoint;
          destSnapPoint = route.destSnapPoint;
        }
      } catch {}

      if (distance <= maxDist) {
        allOptions.push({
          stage: "LPU Viável",
          provider_name: provider.name,
          provider_id: provider.id,
          provider_color: provider.color,
          distance_m: Math.round(distance),
          lpu_value: lpuValue,
          final_value: Math.round(finalValue * 100) / 100,
          notes: `LPU viável - ${provider.name} - ${Math.round(distance)}m`,
          nearest_point: bestNearest.point,
          route_geometry: routeGeometry,
          snap_point: snapPoint,
          dest_snap_point: destSnapPoint,
          has_cross_ntt: provider.has_cross_ntt,
        });
      }
    } catch {
      // skip
    }
  }

  // === Etapa 3: LM Histórico ===
  if (item.velocidade_mbps != null && item.velocidade_mbps <= 100 && comprasLM.length > 0) {
    const RADIUS_KM = 50;
    let bestLM: CompraLM | null = null;
    let bestDist = Infinity;

    for (const lm of comprasLM) {
      if (lm.lat == null || lm.lng == null) continue;
      if (lm.status?.toUpperCase() !== "ATIVO") continue;
      const dLat = (lm.lat - lat) * 111.32;
      const dLng = (lm.lng - lng) * 111.32 * Math.cos(lat * Math.PI / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      if (dist <= RADIUS_KM && dist < bestDist) {
        bestDist = dist;
        bestLM = lm;
      }
    }

    if (bestLM) {
      allOptions.push({
        stage: "LM Histórico",
        provider_name: bestLM.parceiro,
        provider_id: "lm",
        provider_color: "#f59e0b",
        distance_m: Math.round(bestDist * 1000),
        lpu_value: bestLM.valor_mensal,
        final_value: bestLM.valor_mensal,
        notes: `LM Histórico - ${bestLM.parceiro} - ${bestDist.toFixed(1)}km - R$${bestLM.valor_mensal}`,
      });
    }
  }

  // === Etapa 4: Pré-Cadastro (por cidade) ===
  if (item.cidade_a && preProviders.length > 0) {
    const cidadeNorm = item.cidade_a.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const pp of preProviders) {
      const match = pp.cities.some(c => {
        const cNorm = c.cidade.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return cNorm === cidadeNorm;
      });
      if (match) {
        allOptions.push({
          stage: "Pré-Cadastro",
          provider_name: pp.nome_fantasia,
          provider_id: `pre_${pp.id}`,
          provider_color: "#8b5cf6",
          distance_m: 0,
          lpu_value: null,
          final_value: null,
          notes: `Pré-Cadastro - ${pp.nome_fantasia} atende ${item.cidade_a}${pp.has_cross_ntt ? " (Cross NTT)" : ""}`,
          has_cross_ntt: pp.has_cross_ntt,
        });
      }
    }
  }

  // === Selecionar melhor opção ===
  if (allOptions.length > 0) {
    // Prioridade: Rede Própria > Cross NTT > Dentro Cobertura > LPU Viável > LM Histórico > Pré-Cadastro
    const stageOrder: Record<string, number> = {
      "Rede Própria": 0,
      "Cross NTT": 1,
      "Dentro Cobertura": 2,
      "LPU Viável": 3,
      "LM Histórico": 4,
      "Pré-Cadastro": 5,
    };
    const sorted = [...allOptions].sort((a, b) => {
      // Blocked options go last, then check_om, then normal
      if (a.is_blocked && !b.is_blocked) return 1;
      if (!a.is_blocked && b.is_blocked) return -1;
      if (a.is_check_om && !b.is_check_om) return 1;
      if (!a.is_check_om && b.is_check_om) return -1;
      return (stageOrder[a.stage] ?? 9) - (stageOrder[b.stage] ?? 9) || a.distance_m - b.distance_m;
    });
    
    // Best is first non-blocked, non-check_om option
    const bestNonBlocked = sorted.find(o => !o.is_blocked && !o.is_check_om);
    // If no fully viable option, prefer check_om over blocked
    const bestCheckOm = !bestNonBlocked ? sorted.find(o => o.is_check_om) : null;
    const best = bestNonBlocked || bestCheckOm || sorted[0];
    const isViable = !!bestNonBlocked;
    const isCheckOm = !isViable && !!bestCheckOm;

    // Build notes with all options summary
    const optionsSummary = allOptions.length > 1
      ? `\n[+${allOptions.length - 1} opções: ${allOptions.filter(o => o !== best).map(o => `${o.stage}/${o.provider_name}${o.is_blocked ? " (bloqueado)" : o.is_check_om ? " (checar O&M)" : ""}`).join(", ")}]`
      : "";

    return {
      best: {
        stage: best.stage,
        provider_name: best.provider_name,
        distance_m: best.distance_m,
        lpu_value: best.lpu_value,
        final_value: best.final_value,
        is_viable: isViable,
        is_check_om: isCheckOm,
        notes: (best.is_blocked ? `INVIÁVEL - ${best.notes}` : best.is_check_om ? best.notes : best.notes) + optionsSummary,
        ta_info: best.ta_info,
      },
      all_options: sorted,
    };
  }

  return {
    best: {
      stage: null,
      provider_name: null,
      distance_m: null,
      lpu_value: null,
      final_value: null,
      is_viable: false,
      notes: "Sem viabilidade encontrada",
    },
    all_options: [],
  };
}

/**
 * Salva resultado de um item diretamente no banco.
 */
async function saveItemResult(result: WsResult): Promise<void> {
  const notes = result.notes || "";
  const processingStatus = result.is_viable
    ? "viable"
    : result.is_check_om
      ? "check_om"
      : result.geo_source === "nao_encontrado"
        ? "geo_failed"
        : "not_viable";
  await supabase
    .from("ws_feasibility_items")
    .update({
      lat_a: result.geo_lat,
      lng_a: result.geo_lng,
      processing_status: processingStatus,
      result_stage: result.stage,
      result_provider: result.provider_name,
      result_value: result.final_value,
      result_distance_m: result.distance_m,
      result_notes: notes,
      is_viable: result.is_viable,
      observacoes_system: notes,
      attempt_count: 1,
    })
    .eq("id", result.item.id);
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
  onItemResult?: (result: WsResult, index: number) => void,
  startIndex: number = 0,
  preProviders: PreProviderWithCities[] = [],
): Promise<WsResult[]> {
  const elementsByProvider: Record<string, GeoElement[]> = {};
  for (const el of geoElements) {
    if (!elementsByProvider[el.provider_id]) elementsByProvider[el.provider_id] = [];
    elementsByProvider[el.provider_id].push(el);
  }

  const results: WsResult[] = [];
  const PARALLEL_BATCH = 3;

  for (let i = startIndex; i < items.length; i += PARALLEL_BATCH) {
    const batch = items.slice(i, Math.min(i + PARALLEL_BATCH, items.length));

    const withCoords: { item: WsItemInput; idx: number }[] = [];
    const needGeo: { item: WsItemInput; idx: number }[] = [];

    batch.forEach((item, bIdx) => {
      if (item.lat_a != null && item.lng_a != null) {
        withCoords.push({ item, idx: i + bIdx });
      } else {
        needGeo.push({ item, idx: i + bIdx });
      }
    });

    const coordPromises = withCoords.map(async ({ item, idx }) => {
      const result = await processSingleItem(item, { lat: item.lat_a!, lng: item.lng_a!, source: "coordenada" as const }, providers, elementsByProvider, lpuItems, comprasLM, preProviders);
      await saveItemResult(result);
      return { result, idx };
    });

    const geoResultsArr: { result: WsResult; idx: number }[] = [];
    for (const { item, idx } of needGeo) {
      const geo = await resolveGeo(item);
      const result = await processSingleItem(item, geo, providers, elementsByProvider, lpuItems, comprasLM, preProviders);
      await saveItemResult(result);
      geoResultsArr.push({ result, idx });
      if (geo.source === "endereco") {
        await new Promise(r => setTimeout(r, 1100));
      }
    }

    const coordResults = await Promise.all(coordPromises);
    const allBatchResults = [...coordResults, ...geoResultsArr].sort((a, b) => a.idx - b.idx);

    for (const { result, idx } of allBatchResults) {
      results.push(result);
      onItemResult?.(result, idx);
    }

    const processed = Math.min(i + batch.length, items.length);
    onProgress?.({
      current: processed,
      total: items.length,
      currentItem: batch[batch.length - 1]?.designacao || batch[batch.length - 1]?.endereco_a || `Linha ${batch[batch.length - 1]?.row_number}`,
    });
  }

  return results;
}

export async function processWsSingleItem(
  item: WsItemInput,
  geo: { lat: number | null; lng: number | null; source: "coordenada" | "cep" | "endereco" | "nao_encontrado" },
  providers: Provider[],
  geoElements: GeoElement[],
  lpuItems: LpuItem[],
  comprasLM: CompraLM[],
  preProviders: PreProviderWithCities[] = [],
): Promise<WsResult> {
  const elementsByProvider: Record<string, GeoElement[]> = {};
  for (const el of geoElements) {
    if (!elementsByProvider[el.provider_id]) elementsByProvider[el.provider_id] = [];
    elementsByProvider[el.provider_id].push(el);
  }

  return processSingleItem(item, geo, providers, elementsByProvider, lpuItems, comprasLM, preProviders);
}

/** Helper to process a single item with resolved geo */
async function processSingleItem(
  item: WsItemInput,
  geo: { lat: number | null; lng: number | null; source: "coordenada" | "cep" | "endereco" | "nao_encontrado" },
  providers: Provider[],
  elementsByProvider: Record<string, GeoElement[]>,
  lpuItems: LpuItem[],
  comprasLM: CompraLM[],
  preProviders: PreProviderWithCities[] = [],
): Promise<WsResult> {
  if (geo.lat == null || geo.lng == null) {
    return {
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
      all_options: [],
    };
  }

  const { best, all_options } = await processItem(item, geo.lat, geo.lng, providers, elementsByProvider, lpuItems, comprasLM, preProviders);
  return {
    item,
    geo_lat: geo.lat,
    geo_lng: geo.lng,
    geo_source: geo.source,
    ...best,
    all_options,
  };
}
