import { kml } from "@tmcw/togeojson";
import JSZip from "jszip";
import { convertNumberWords, convertDigitsToWords } from "@/lib/number-words";

export function parseKML(text: string): GeoJSON.FeatureCollection {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/xml");
  return kml(doc) as GeoJSON.FeatureCollection;
}

export async function parseKMZ(arrayBuffer: ArrayBuffer): Promise<GeoJSON.FeatureCollection> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const kmlFile = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith(".kml"));
  if (!kmlFile) throw new Error("Nenhum arquivo KML encontrado dentro do KMZ");
  const text = await zip.files[kmlFile].async("string");
  return parseKML(text);
}

export function parseGeoJSON(text: string): GeoJSON.FeatureCollection {
  const parsed = JSON.parse(text);
  if (parsed.type === "FeatureCollection") return parsed;
  if (parsed.type === "Feature") return { type: "FeatureCollection", features: [parsed] };
  return { type: "FeatureCollection", features: [{ type: "Feature", geometry: parsed, properties: {} }] };
}

export function getGeometryType(geometry: GeoJSON.Geometry): string {
  switch (geometry.type) {
    case "Point":
    case "MultiPoint":
      return "point";
    case "LineString":
    case "MultiLineString":
      return "line";
    case "Polygon":
    case "MultiPolygon":
      return "polygon";
    default:
      return "point";
  }
}

/** Check if a LineString is closed (first point equals last point, with at least 4 coords) */
function isClosedLine(coords: number[][]): boolean {
  if (!coords || coords.length < 4) return false;
  const first = coords[0];
  const last = coords[coords.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

/** Check if a closed ring encloses a significant area (not a tiny network loop) */
function isSignificantPolygon(coords: number[][]): boolean {
  if (coords.length < 10) return false;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const c of coords) {
    if (c[0] < minLng) minLng = c[0];
    if (c[0] > maxLng) maxLng = c[0];
    if (c[1] < minLat) minLat = c[1];
    if (c[1] > maxLat) maxLat = c[1];
  }
  return (maxLng - minLng) > 0.003 && (maxLat - minLat) > 0.003;
}

/** Ensure a ring has counter-clockwise (CCW) winding order for GeoJSON exterior rings. */
function ensureCCW(ring: number[][]): number[][] {
  if (!Array.isArray(ring) || ring.length < 4) return ring;

  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];

  // Signed area (shoelace): >0 = CCW, <0 = CW
  let signedArea = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [x1, y1] = closed[i];
    const [x2, y2] = closed[i + 1];
    signedArea += x1 * y2 - x2 * y1;
  }

  if (signedArea >= 0) return closed;
  return [...closed].reverse();
}

/** Convert closed LineStrings to Polygons for filled rendering.
 *  Only converts lines that enclose a significant area (coverage "manchas").
 *  Also normalizes winding order of existing Polygons/MultiPolygons to CCW
 *  so they render correctly instead of covering the whole globe. */
export function closedLineToPolygon(geometry: any): any {
  if (!geometry) return geometry;

  // Normalize existing Polygon winding order
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring: number[][], i: number) =>
        i === 0 ? ensureCCW(ring) : ring
      ),
    };
  }

  // Normalize existing MultiPolygon winding order
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon: number[][][]) =>
        polygon.map((ring: number[][], i: number) =>
          i === 0 ? ensureCCW(ring) : ring
        )
      ),
    };
  }

  if (geometry.type === "LineString" && isClosedLine(geometry.coordinates) && isSignificantPolygon(geometry.coordinates)) {
    return { type: "Polygon", coordinates: [ensureCCW(geometry.coordinates)] };
  }
  if (geometry.type === "MultiLineString") {
    const significant = geometry.coordinates.filter((line: number[][]) => isClosedLine(line) && isSignificantPolygon(line));
    const rest = geometry.coordinates.filter((line: number[][]) => !(isClosedLine(line) && isSignificantPolygon(line)));
    if (significant.length === 0) return geometry;
    if (rest.length === 0) {
      return { type: "MultiPolygon", coordinates: significant.map((ring: number[][]) => [ensureCCW(ring)]) };
    }
    return geometry;
  }
  return geometry;
}

/** Haversine distance in meters */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Find the nearest point in a set of geo elements to a given lat/lng */
export function findNearestPoint(
  lat: number,
  lng: number,
  elements: Array<{ geometry: any; provider_id: string; properties?: any }>
): { distance: number; point: [number, number]; providerId: string; properties?: any } | null {
  let nearest: { distance: number; point: [number, number]; providerId: string; properties?: any } | null = null;

  for (const el of elements) {
    const geo = el.geometry;
    const points = extractPoints(geo);
    for (const p of points) {
      const d = haversineDistance(lat, lng, p[1], p[0]);
      if (!nearest || d < nearest.distance) {
        nearest = { distance: d, point: [p[1], p[0]], providerId: el.provider_id, properties: el.properties };
      }
    }
  }
  return nearest;
}

export interface TAResult {
  distance: number;
  point: [number, number]; // [lat, lng]
  nome: string;
  tipo: "TA" | "CE";
  portaDisponivel: boolean;
  aptoNovoCliente: boolean;
  motivoBloqueio?: string;
  motivo: "mais_proximo" | "verde_mais_proximo" | "fallback_saturado" | "sem_apto";
  mensagem?: string;
}

/** Provider rules interface for feasibility logic */
export interface ProviderRules {
  regras_usar_porta_disponivel: boolean;
  regras_considerar_ta: boolean;
  regras_considerar_ce: boolean;
  regras_bloquear_splitter_1x2: boolean;
  regras_bloquear_splitter_des: boolean;
  regras_bloquear_portas_livres_zero: boolean;
  regras_bloquear_atendimento_nao_sim: boolean;
  regras_habilitar_exclusao_cpfl: boolean;
}

type ConnectionCandidate = {
  lat: number;
  lng: number;
  nome: string;
  tipo: "TA" | "CE";
  portaDisponivel: boolean;
  aptoNovoCliente: boolean;
  motivoBloqueio?: string;
  distance: number;
};

/** Check if a connection point (TA/CE) is apt for a new client based on provider rules */
export function evaluateConnectionAptness(
  props: any,
  rules: ProviderRules
): { apto: boolean; motivo?: string } {
  // porta_disponivel filter (legacy, only for TA)
  if (props.tipo === "TA" && rules.regras_usar_porta_disponivel && props.porta_disponivel !== true) {
    return { apto: false, motivo: "TA sem porta disponível" };
  }

  // Splitter validation applies to both TAs and CEs
  if (!props.tem_splitter) {
    return { apto: false, motivo: "Sem dados de splitter — necessita viabilidade real" };
  }

  // Splitter rules
  if (rules.regras_bloquear_splitter_1x2 && props.splitter_tem_1x2 === true) {
    return { apto: false, motivo: "Splitter 1x2 presente — bloqueado por regra" };
  }
  if (rules.regras_bloquear_splitter_des && props.splitter_tem_des === true) {
    return { apto: false, motivo: "Splitter DES presente — bloqueado por regra" };
  }
  if (rules.regras_bloquear_portas_livres_zero && (props.splitter_portas_livres === 0 || props.splitter_portas_livres === null)) {
    return { apto: false, motivo: "Sem portas livres no splitter" };
  }
  if (rules.regras_bloquear_atendimento_nao_sim && props.splitter_atendimento_all_sim !== true) {
    return { apto: false, motivo: "Atendimento não confirmado (all_sim = false)" };
  }

  return { apto: true };
}

function buildConnectionCandidates(
  lat: number,
  lng: number,
  elements: Array<{ geometry: any; provider_id: string; properties?: any }>,
  rules: ProviderRules
): ConnectionCandidate[] {
  const candidates: ConnectionCandidate[] = [];

  for (const el of elements) {
    const props = (typeof el.properties === "string" ? JSON.parse(el.properties) : el.properties) || {};
    const tipo = props.tipo;

    // Filter by type based on rules
    if (tipo === "TA" && !rules.regras_considerar_ta) continue;
    if (tipo === "CE" && !rules.regras_considerar_ce) continue;
    if (tipo !== "TA" && tipo !== "CE") continue;

    const geo = typeof el.geometry === "string" ? JSON.parse(el.geometry) : el.geometry;
    if (geo?.type !== "Point") continue;

    const [lng2, lat2] = geo.coordinates;
    const d = haversineDistance(lat, lng, lat2, lng2);
    const aptCheck = evaluateConnectionAptness(props, rules);

    candidates.push({
      lat: lat2,
      lng: lng2,
      nome: props.nome || tipo,
      tipo: tipo as "TA" | "CE",
      portaDisponivel: props.porta_disponivel === true,
      aptoNovoCliente: aptCheck.apto,
      motivoBloqueio: aptCheck.motivo,
      distance: d,
    });
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates;
}

/** Find the best connection point (TA/CE) using provider rules (shortest straight-line fallback) */
export function findBestConnectionPoint(
  lat: number,
  lng: number,
  elements: Array<{ geometry: any; provider_id: string; properties?: any }>,
  limitMeters: number,
  rules: ProviderRules
): TAResult | null {
  const candidates = buildConnectionCandidates(lat, lng, elements, rules);
  if (candidates.length === 0) return null;

  const aptWithinLimit = candidates.filter(c => c.aptoNovoCliente && c.distance <= limitMeters);
  if (aptWithinLimit.length > 0) {
    const best = aptWithinLimit[0];
    return {
      distance: best.distance,
      point: [best.lat, best.lng],
      nome: best.nome,
      tipo: best.tipo,
      portaDisponivel: best.portaDisponivel,
      aptoNovoCliente: true,
      motivo: "mais_proximo",
    };
  }

  const nearest = candidates[0];
  return {
    distance: nearest.distance,
    point: [nearest.lat, nearest.lng],
    nome: nearest.nome,
    tipo: nearest.tipo,
    portaDisponivel: nearest.portaDisponivel,
    aptoNovoCliente: false,
    motivoBloqueio: nearest.motivoBloqueio,
    motivo: "sem_apto",
    mensagem: "Ponto mais próximo sem condição para ativação pelas regras atuais. Necessária viabilidade real via equipe Delivery.",
  };
}

/**
 * Find the best connection point with strict nearest-candidate priority.
 * Rule:
 * 1) Prefer nearest apt candidate within limit (straight-line sorted).
 * 2) If none apt, prefer nearest candidate within limit.
 * 3) If none in limit, fallback to nearest candidate overall.
 *
 * Candidate choice is always by nearest point first; route is then computed for that choice.
 */
export async function findBestConnectionPointByRoute(
  lat: number,
  lng: number,
  elements: Array<{ geometry: any; provider_id: string; properties?: any }>,
  limitMeters: number,
  rules: ProviderRules,
  maxCandidates: number = Number.POSITIVE_INFINITY,
  routeFilter?: (
    candidate: ConnectionCandidate,
    route: { distance: number; geometry: any }
  ) => boolean | Promise<boolean>
): Promise<{ taResult: TAResult; routeDistance: number; routeGeometry: any } | null> {
  const candidates = buildConnectionCandidates(lat, lng, elements, rules);
  if (candidates.length === 0) return null;

  const aptWithinLimit = candidates.filter((c) => c.aptoNovoCliente && c.distance <= limitMeters);
  const withinLimit = candidates.filter((c) => c.distance <= limitMeters);

  const inAptPhase = aptWithinLimit.length > 0;
  const inLimitPhase = !inAptPhase && withinLimit.length > 0;

  const orderedCandidates = inAptPhase
    ? aptWithinLimit
    : inLimitPhase
      ? withinLimit
      : candidates;

  const candidateLimit = Number.isFinite(maxCandidates)
    ? Math.max(1, Math.floor(maxCandidates))
    : orderedCandidates.length;

  // Pre-filter by straight-line distance (cheap), then only compute expensive
  // route distances for the top few apt candidates
  const preFiltered = orderedCandidates.slice(0, candidateLimit);
  
  // Among pre-filtered, pick top 3 apt candidates to compute routes for
  // This dramatically reduces OSRM + Overpass API calls
  const ROUTE_CALC_LIMIT = 3;
  const aptForRoute = preFiltered.filter(c => c.aptoNovoCliente).slice(0, ROUTE_CALC_LIMIT);
  // If no apt candidates, fall back to top 3 overall
  const searchList = aptForRoute.length > 0 ? aptForRoute : preFiltered.slice(0, ROUTE_CALC_LIMIT);

  let best:
    | { candidate: ConnectionCandidate; route: { distance: number; geometry: any } }
    | null = null;

  for (const candidate of searchList) {
    const route = await getRouteDistance(lat, lng, candidate.lat, candidate.lng);
    if (!route) continue;

    if (routeFilter) {
      const accepted = await routeFilter(candidate, route);
      if (!accepted) continue;
    }

    if (!best || route.distance < best.route.distance) {
      best = { candidate, route };
    }
  }

  if (best) {
    const isApto = inAptPhase ? true : best.candidate.aptoNovoCliente;
    const isSemApto = !isApto;

    return {
      taResult: {
        distance: best.route.distance,
        point: [best.candidate.lat, best.candidate.lng],
        nome: best.candidate.nome,
        tipo: best.candidate.tipo,
        portaDisponivel: best.candidate.portaDisponivel,
        aptoNovoCliente: isApto,
        motivoBloqueio: best.candidate.motivoBloqueio,
        motivo: isSemApto ? "sem_apto" : "mais_proximo",
        mensagem: isSemApto
          ? "Ponto mais próximo sem condição para ativação pelas regras atuais. Necessária viabilidade real via equipe Delivery."
          : undefined,
      },
      routeDistance: best.route.distance,
      routeGeometry: best.route.geometry,
    };
  }

  // With a route filter, not finding an accepted candidate means no viable route among searched candidates
  if (routeFilter) return null;

  // If routing fails for all candidates, fallback to nearest candidate by straight-line
  const fallback = preFiltered[0] ?? candidates[0];
  const fallbackIsApto = inAptPhase ? true : fallback.aptoNovoCliente;

  return {
    taResult: {
      distance: fallback.distance,
      point: [fallback.lat, fallback.lng],
      nome: fallback.nome,
      tipo: fallback.tipo,
      portaDisponivel: fallback.portaDisponivel,
      aptoNovoCliente: fallbackIsApto,
      motivoBloqueio: fallback.motivoBloqueio,
      motivo: fallbackIsApto ? "mais_proximo" : "sem_apto",
      mensagem: fallbackIsApto
        ? undefined
        : "Ponto mais próximo sem condição para ativação pelas regras atuais. Necessária viabilidade real via equipe Delivery.",
    },
    routeDistance: fallback.distance,
    routeGeometry: null,
  };
}

/** Find the best TA (Terminal de Atendimento) for connection.
 *  Legacy function - kept for backward compat. Adds tipo/aptoNovoCliente fields.
 */
export function findBestTA(
  lat: number,
  lng: number,
  elements: Array<{ geometry: any; provider_id: string; properties?: any }>,
  limitMeters: number,
  useSaturatedTa: boolean = false
): TAResult | null {
  const taElements: Array<{ lat: number; lng: number; nome: string; portaDisponivel: boolean; distance: number }> = [];

  for (const el of elements) {
    const props = (typeof el.properties === "string" ? JSON.parse(el.properties) : el.properties) || {};
    if (props.tipo !== "TA") continue;
    const geo = typeof el.geometry === "string" ? JSON.parse(el.geometry) : el.geometry;
    if (geo?.type !== "Point") continue;
    const [lng2, lat2] = geo.coordinates;
    const d = haversineDistance(lat, lng, lat2, lng2);
    taElements.push({
      lat: lat2, lng: lng2,
      nome: props.nome || "TA",
      portaDisponivel: useSaturatedTa ? true : (props.porta_disponivel === true),
      distance: d,
    });
  }

  if (taElements.length === 0) return null;
  taElements.sort((a, b) => a.distance - b.distance);
  const nearest = taElements[0];

  if (nearest.portaDisponivel && nearest.distance <= limitMeters) {
    return { distance: nearest.distance, point: [nearest.lat, nearest.lng], nome: nearest.nome, tipo: "TA", portaDisponivel: true, aptoNovoCliente: true, motivo: "mais_proximo" };
  }

  if (!nearest.portaDisponivel) {
    const greenTAs = taElements.filter(t => t.portaDisponivel && t.distance <= limitMeters);
    if (greenTAs.length > 0) {
      const best = greenTAs[0];
      return { distance: best.distance, point: [best.lat, best.lng], nome: best.nome, tipo: "TA", portaDisponivel: true, aptoNovoCliente: true, motivo: "verde_mais_proximo" };
    }
    return {
      distance: nearest.distance, point: [nearest.lat, nearest.lng], nome: nearest.nome, tipo: "TA",
      portaDisponivel: false, aptoNovoCliente: false, motivo: "fallback_saturado",
      mensagem: "O TA mais próximo está saturado (sem porta disponível). Para prosseguir, é necessária viabilidade real via equipe Delivery.",
    };
  }

  const greenWithinLimit = taElements.filter(t => t.portaDisponivel && t.distance <= limitMeters);
  if (greenWithinLimit.length > 0) {
    return { distance: greenWithinLimit[0].distance, point: [greenWithinLimit[0].lat, greenWithinLimit[0].lng], nome: greenWithinLimit[0].nome, tipo: "TA", portaDisponivel: true, aptoNovoCliente: true, motivo: "verde_mais_proximo" };
  }

  return { distance: nearest.distance, point: [nearest.lat, nearest.lng], nome: nearest.nome, tipo: "TA", portaDisponivel: nearest.portaDisponivel, aptoNovoCliente: nearest.portaDisponivel, motivo: "mais_proximo" };
}

function extractPoints(geometry: any): [number, number][] {
  if (!geometry) return [];
  switch (geometry.type) {
    case "Point":
      return [geometry.coordinates as [number, number]];
    case "MultiPoint":
      return geometry.coordinates;
    case "LineString":
      return geometry.coordinates;
    case "MultiLineString":
      return geometry.coordinates.flat();
    case "Polygon":
      return geometry.coordinates.flat();
    case "MultiPolygon":
      return geometry.coordinates.flat(2);
    default:
      return [];
  }
}

/** Extract all polygon rings from a geometry, including closed LineStrings */
function extractPolygonRings(geometry: any): number[][][] {
  if (!geometry) return [];
  switch (geometry.type) {
    case "Polygon":
      return geometry.coordinates.map((ring: number[][]) => ring);
    case "MultiPolygon":
      return geometry.coordinates.flat().map((ring: number[][]) => ring);
    case "LineString": {
      // Treat closed LineStrings (first point = last point) as polygon rings
      const coords = geometry.coordinates;
      if (coords && coords.length >= 4) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] === last[0] && first[1] === last[1]) {
          return [coords];
        }
      }
      return [];
    }
    case "MultiLineString": {
      const rings: number[][][] = [];
      for (const line of geometry.coordinates) {
        if (line && line.length >= 4) {
          const first = line[0];
          const last = line[line.length - 1];
          if (first[0] === last[0] && first[1] === last[1]) {
            rings.push(line);
          }
        }
      }
      return rings;
    }
    default:
      return [];
  }
}

/** Ray-casting point-in-polygon test. Point is [lng, lat], ring is array of [lng, lat, ...]. */
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Check if a lat/lng point is inside coverage of the given geo elements.
 *  Uses even-odd rule: a small closed polygon inside a larger one represents a
 *  coverage hole. The point is covered only if it falls inside an odd number of rings. */
export function isInsideCoverage(
  lat: number,
  lng: number,
  elements: Array<{ geometry: any }>
): boolean {
  let hitCount = 0;
  for (const el of elements) {
    const geo = typeof el.geometry === "string" ? JSON.parse(el.geometry) : el.geometry;
    const rings = extractPolygonRings(geo);
    for (const ring of rings) {
      if (pointInRing(lng, lat, ring)) hitCount++;
    }
  }
  // Odd = inside coverage, Even = inside a hole (not covered)
  return hitCount > 0 && hitCount % 2 === 1;
}

/** Find the nearest point on the boundary of polygon elements */
export function findNearestBoundaryPoint(
  lat: number,
  lng: number,
  elements: Array<{ geometry: any; provider_id: string }>
): { distance: number; point: [number, number] } | null {
  let nearest: { distance: number; point: [number, number] } | null = null;
  for (const el of elements) {
    const rings = extractPolygonRings(el.geometry);
    for (const ring of rings) {
      for (const p of ring) {
        const d = haversineDistance(lat, lng, p[1], p[0]);
        if (!nearest || d < nearest.distance) {
          nearest = { distance: d, point: [p[1], p[0]] };
        }
      }
    }
  }
  return nearest;
}

/** Calculate route distance via OSRM prioritizing the shortest physical route.
 *  Strategy:
 *  1) Request A→B and B→A (driving) with alternatives=true.
 *  2) Compare all returned alternatives by `distance` (meters).
 *  3) Pick the smallest distance route and normalize geometry direction to A→B.
 */
export async function getRouteDistance(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<{ distance: number; geometry: any } | null> {
  const fetchDrivingAlternatives = async (aLat: number, aLng: number, bLat: number, bLng: number) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${aLng},${aLat};${bLng},${bLat}?overview=full&geometries=geojson&alternatives=true&steps=false`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.code === "Ok" && Array.isArray(data.routes) && data.routes.length > 0) {
        return data.routes
          .filter((r: any) => typeof r?.distance === "number" && r?.geometry)
          .map((r: any) => ({ distance: r.distance as number, geometry: r.geometry }));
      }
      return [] as Array<{ distance: number; geometry: any }>;
    } catch {
      return [] as Array<{ distance: number; geometry: any }>;
    }
  };

  const reverseGeometry = (geometry: any) => {
    if (!geometry) return geometry;
    if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
      return { ...geometry, coordinates: [...geometry.coordinates].reverse() };
    }
    if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
      return {
        ...geometry,
        coordinates: [...geometry.coordinates].reverse().map((line: number[][]) => [...line].reverse()),
      };
    }
    return geometry;
  };

  try {
    const [forwardRoutes, reverseRoutes] = await Promise.all([
      fetchDrivingAlternatives(fromLat, fromLng, toLat, toLng),
      fetchDrivingAlternatives(toLat, toLng, fromLat, fromLng),
    ]);

    const normalized = [
      ...forwardRoutes.map((r) => ({ distance: r.distance, geometry: r.geometry })),
      ...reverseRoutes.map((r) => ({ distance: r.distance, geometry: reverseGeometry(r.geometry) })),
    ];

    if (normalized.length === 0) return null;

    normalized.sort((a, b) => a.distance - b.distance);
    return normalized[0];
  } catch {
    return null;
  }
}

/** Check if a route LineString crosses any CPFL exclusion polygon */
export function routeCrossesCPFL(
  routeGeometry: any,
  elements: Array<{ geometry: any; properties?: any }>
): { crosses: boolean; message?: string } {
  if (!routeGeometry) return { crosses: false };

  // Extract route points
  const routeCoords: number[][] = [];
  const geo = typeof routeGeometry === "string" ? JSON.parse(routeGeometry) : routeGeometry;
  if (geo.type === "LineString") {
    routeCoords.push(...geo.coordinates);
  } else if (geo.type === "MultiLineString") {
    for (const line of geo.coordinates) routeCoords.push(...line);
  }
  if (routeCoords.length === 0) return { crosses: false };

  // Find CPFL exclusion polygons
  for (const el of elements) {
    const props = (typeof el.properties === "string" ? JSON.parse(el.properties) : el.properties) || {};
    if (props.tipo !== "EXCLUSAO_CPFL") continue;
    if (props.bloqueia_viabilidade !== true) continue;

    const elGeo = typeof el.geometry === "string" ? JSON.parse(el.geometry) : el.geometry;
    const rings = extractPolygonRings(elGeo);
    if (rings.length === 0) continue;

    // Check if any route point falls inside the exclusion polygon
    for (const coord of routeCoords) {
      for (const ring of rings) {
        if (pointInRing(coord[0], coord[1], ring)) {
          return {
            crosses: true,
            message: "INVIÁVEL – Rota cruza região de exclusão CPFL (Centro Campinas). Bloqueado até atualização com a CPFL.",
          };
        }
      }
    }

    // Check line segment intersections with polygon edges
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const a1 = routeCoords[i];
      const a2 = routeCoords[i + 1];
      for (const ring of rings) {
        for (let j = 0; j < ring.length - 1; j++) {
          if (segmentsIntersect(a1[0], a1[1], a2[0], a2[1], ring[j][0], ring[j][1], ring[j + 1][0], ring[j + 1][1])) {
            return {
              crosses: true,
              message: "INVIÁVEL – Rota cruza região de exclusão CPFL (Centro Campinas). Bloqueado até atualização com a CPFL.",
            };
          }
        }
      }
    }
  }

  return { crosses: false };
}

/** Check if two line segments intersect */
function segmentsIntersect(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number
): boolean {
  const d = (ax2 - ax1) * (by2 - by1) - (ay2 - ay1) * (bx2 - bx1);
  if (Math.abs(d) < 1e-10) return false;
  const t = ((bx1 - ax1) * (by2 - by1) - (by1 - ay1) * (bx2 - bx1)) / d;
  const u = ((bx1 - ax1) * (ay2 - ay1) - (by1 - ay1) * (ax2 - ax1)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Clean address for better geocoding: remove CEP, special chars, extra info */
export function cleanAddressForSearch(address: string): string {
  return cleanAddressForGeocoding(address);
}

function cleanAddressForGeocoding(address: string): string {
  let clean = address;
  // Handle multi-point addresses: "PONTA A ENDEREÇO: ... PONTA B ENDEREÇO: ..." → keep only first
  if (/PONTA\s*[AB]\s*ENDERE[ÇC]O/i.test(clean)) {
    clean = clean.replace(/\s*PONTA\s*B\s*ENDERE[ÇC]O\s*:.*$/gis, "");
    clean = clean.replace(/PONTA\s*A\s*ENDERE[ÇC]O\s*:\s*/i, "");
  }
  // Handle "Endereço (A)...\nEndereço (B)..." → keep only first address line
  if (/Endere[çc]o\s*\(B\)/i.test(clean)) {
    clean = clean.replace(/\r?\nEndere[çc]o\s*\(B\).*$/gis, "");
    clean = clean.replace(/^Endere[çc]o\s*\(A\)\s*/i, "");
  }
  // Remove multiple addresses separated by ///
  clean = clean.replace(/\/{2,}.*$/g, "");
  // Remove CEP patterns: 13.300-065, 13300-065, 13300065, CEP 13.300-065, CEP: 13300065
  clean = clean.replace(/,?\s*CEP[:\s]?\s*\d{2}\.?\d{3}-?\d{3}/gi, "");
  clean = clean.replace(/,?\s*\d{2}\.\d{3}-\d{3}/g, "");
  clean = clean.replace(/,?\s*\d{5}-\d{3}/g, "");
  clean = clean.replace(/,?\s*\d{8}\b/g, "");
  // Remove parenthetical notes like (Shopping Iguatemi)
  clean = clean.replace(/\([^)]*\)/g, "");
  // Remove "- ANEXO A", "Protocolo XXXX"
  clean = clean.replace(/[-–]\s*ANEXO\s*\w*/gi, "");
  clean = clean.replace(/[-–]?\s*Protocolo\s*\d*/gi, "");
  // Remove "ID XXXX - " prefixes
  clean = clean.replace(/ID\s*\d+\s*[-–]\s*/gi, "");
  // Remove labeled fields: "Complemento:", "Bairro:", "Município:", "Estado:", "CIDADE UF CEP"
  clean = clean.replace(/Complemento\s*:\s*[^,]*/gi, "");
  clean = clean.replace(/Bairro\s*:\s*/gi, "");
  clean = clean.replace(/Munic[ií]pio\s*:\s*/gi, "");
  clean = clean.replace(/Estado\s*:\s*/gi, "");
  clean = clean.replace(/\bCIDADE\s+UF\s+CEP\b/gi, "");
  // Remove "Número:" prefix and "N:" prefix
  clean = clean.replace(/N[úu]mero:\s*/gi, " ");
  clean = clean.replace(/\bN:\s*/gi, "");
  // Remove "SEQ ...: NNNN -" prefixes (e.g. "SEQ BRADESCO: 2166 -")
  clean = clean.replace(/SEQ\s+[^:]+:\s*\d+\s*[-–]\s*/gi, "");
  // Remove "Quadra/Quadrag/Lote" info
  clean = clean.replace(/,?\s*Quadr\w*\s*\d*\s*(Lote\s*\w*)?\s*/gi, "");
  // Remove company/brand prefixes before actual address (e.g. "RA CATERING CONGONHAS PO 03 da Gol,")
  // This is tricky - only remove if followed by a known street type
  clean = clean.replace(/^[^,]*,\s*(?=(Rua|Avenida|Alameda|Travessa|Praça|Rodovia|Estrada|Pra[çc]a)\b)/i, "");
  // Replace common abbreviations
  clean = clean.replace(/\bAV\.\s*/gi, "Avenida ");
  clean = clean.replace(/\bR\.\s*/gi, "Rua ");
  clean = clean.replace(/\bROD\.\s*/gi, "Rodovia ");
  clean = clean.replace(/\bAL\.\s*/gi, "Alameda ");
  clean = clean.replace(/\bTV\.\s*/gi, "Travessa ");
  clean = clean.replace(/\bPÇA?\.\s*/gi, "Praça ");
  clean = clean.replace(/\bPRES\.\s*/gi, "Presidente ");
  clean = clean.replace(/\bGOV\.\s*/gi, "Governador ");
  clean = clean.replace(/\bDR\.\s*/gi, "Doutor ");
  clean = clean.replace(/\bPROF\.\s*/gi, "Professor ");
  clean = clean.replace(/\bENG\.\s*/gi, "Engenheiro ");
  clean = clean.replace(/\bSTA\.\s*/gi, "Santa ");
  clean = clean.replace(/\bSTO\.\s*/gi, "Santo ");
  clean = clean.replace(/\bJD\.\s*/gi, "Jardim ");
  clean = clean.replace(/\bTRAB\.\s*/gi, "Trabalhadores ");
  clean = clean.replace(/\bTERM\.\s*/gi, "Terminal ");
  clean = clean.replace(/\bEST\.\s*/gi, "Estrada ");
  // Remove ordinal indicators (º, ª) attached to numbers or words
  clean = clean.replace(/[º°ª]/g, "");
  // Replace / with , for city/state (e.g. CAMPINAS/SP -> CAMPINAS, SP)
  clean = clean.replace(/\/([A-Z]{2})\b/g, ", $1");
  // Remove S/Nº and SN variants
  clean = clean.replace(/,?\s*S\/N[º°]?\b/gi, "");
  clean = clean.replace(/,?\s*\bSN\b/gi, "");
  // Remove "BAIRRO" prefix (Nominatim doesn't need it)
  clean = clean.replace(/\bBAIRRO\s+/gi, "");
  // Remove "CENTRO." with trailing period
  clean = clean.replace(/\bCENTRO\.\s*/gi, "Centro ");
  // Remove "- SUC S414/415" type suffixes
  clean = clean.replace(/[-–]\s*SUC\s+\S+/gi, "");
  // Remove "KM XX" from addresses (except for highways which need it)
  // Only remove if not preceded by Rodovia/Rod
  // Remove "Parte ," filler
  clean = clean.replace(/,?\s*Parte\s*,?/gi, ",");
  // Remove non-breaking spaces and extra whitespace
  clean = clean.replace(/\u00A0/g, " ");
  clean = clean.replace(/\s+/g, " ").trim();
  // Remove trailing commas/dashes
  clean = clean.replace(/[,\-–\s]+$/, "").trim();
  // Remove leading commas/dashes
  clean = clean.replace(/^[,\-–\s]+/, "").trim();
  return clean;
}

/** Simplify address by removing number, neighborhood — keep only street + city + state */
function simplifyAddress(address: string): string {
  let s = address;
  // Remove numbers after street name
  s = s.replace(/,\s*\d+\b/, "");
  // Remove neighborhood-like segments (words after comma before city)
  const parts = s.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length > 3) {
    // Keep first (street), last two (city, state)
    return [parts[0], ...parts.slice(-2)].join(", ");
  }
  return s;
}

/** Extract city and UF from address string */
function extractCityUf(address: string): { city: string; uf: string } | null {
  // Match patterns like "Cidade/SP", "Cidade - SP", "Cidade, SP", "Cidade – SP"
  const m = address.match(/([A-ZÀ-Úa-zà-ú][A-Za-zÀ-ú]+(?:\s+[A-Za-zÀ-ú]+)*)\s*[/,\-–]\s*([A-Z]{2})\b/);
  if (m) {
    const city = m[1].trim();
    const uf = m[2];
    // Validate UF is a real Brazilian state
    const validUFs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
    if (validUFs.includes(uf)) {
      return { city, uf };
    }
  }
  return null;
}

/** Nominatim free-text search */
async function nominatimSearch(query: string): Promise<{ lat: number; lng: number; display: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`
    );
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
    }
    return null;
  } catch {
    return null;
  }
}

/** Nominatim structured search */
async function nominatimStructured(params: Record<string, string>): Promise<{ lat: number; lng: number; display: string } | null> {
  try {
    const sp = new URLSearchParams({ format: "json", limit: "1", country: "BR", ...params });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${sp}`);
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
    }
    return null;
  } catch {
    return null;
  }
}

/** 
 * Geocode an address using Nominatim with multi-step fallback.
 * Optionally accepts cidade/uf from database for better structured fallback.
 */
export async function geocodeAddress(
  address: string,
  dbCidade?: string | null,
  dbUf?: string | null
): Promise<{ lat: number; lng: number; display: string } | null> {
  const cleaned = convertNumberWords(cleanAddressForGeocoding(address));

  // Extract street name and number for structured search
  const streetNumMatch = cleaned.match(/^((?:Avenida|Rua|Rodovia|Alameda|Travessa|Praça|Estrada|Praca)\s+[^,]+?)\s*,\s*(\d+)/i);
  const streetOnlyMatch = cleaned.match(/^((?:Avenida|Rua|Rodovia|Alameda|Travessa|Praça|Estrada|Praca)\s+[^,]+)/i);
  
  const cityUf = extractCityUf(address) || 
    (dbCidade && dbUf ? { city: dbCidade, uf: dbUf } : null);

  // Step 0: Structured search with street + number + city (most precise for house numbers)
  if (streetNumMatch && cityUf) {
    const streetWithNum = `${streetNumMatch[1]}, ${streetNumMatch[2]}`;
    let result = await nominatimStructured({ street: streetWithNum, city: cityUf.city, state: cityUf.uf });
    if (result) return result;
  }

  // Step 1: Full cleaned free-text
  let result = await nominatimSearch(cleaned);
  if (result) return result;

  // Step 1b: Try with digits converted to words (e.g. "Rua 42" → "Rua Quarenta e Dois")
  if (/\d/.test(cleaned)) {
    const withWords = convertDigitsToWords(cleaned);
    if (withWords !== cleaned) {
      await new Promise(r => setTimeout(r, 1100));
      result = await nominatimSearch(withWords);
      if (result) return result;
    }
  }

  // Step 2: Simplified (remove number and extra segments)
  const simplified = simplifyAddress(cleaned);
  if (simplified !== cleaned) {
    await new Promise(r => setTimeout(r, 1100));
    result = await nominatimSearch(simplified);
    if (result) return result;
  }

  // Step 3: Structured search with street (no number) + city/state
  if (cityUf && streetOnlyMatch) {
    await new Promise(r => setTimeout(r, 1100));
    result = await nominatimStructured({ street: streetOnlyMatch[1], city: cityUf.city, state: cityUf.uf });
    if (result) return result;
  }

  // Step 4: Just city + UF
  if (cityUf) {
    await new Promise(r => setTimeout(r, 1100));
    result = await nominatimStructured({ city: cityUf.city, state: cityUf.uf });
    if (result) return result;
  }

  // Step 5: If DB has cidade/uf and extractCityUf also returned something different, try DB values too
  if (dbCidade && dbUf) {
    const fromAddress = extractCityUf(address);
    if (fromAddress && (fromAddress.city !== dbCidade || fromAddress.uf !== dbUf)) {
      await new Promise(r => setTimeout(r, 1100));
      result = await nominatimStructured({ city: dbCidade, state: dbUf });
      if (result) return result;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// Highway / Railway blocking rule
// ═══════════════════════════════════════════════════════════════

interface OverpassWay {
  type: "highway" | "railway";
  tag: string;
  coords: number[][]; // [lng, lat][]
}

/** Fetch highways (motorway/trunk) and railways from OSM Overpass API within a bounding box */
export async function fetchHighwaysAndRailways(
  minLat: number, minLng: number, maxLat: number, maxLng: number
): Promise<OverpassWay[]> {
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = `[out:json][timeout:15];(way["highway"~"^(motorway|trunk|motorway_link|trunk_link)$"](${bbox});way["railway"="rail"](${bbox}););out geom;`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    const ways: OverpassWay[] = [];
    for (const el of data.elements || []) {
      if (el.type !== "way" || !el.geometry) continue;
      const coords = el.geometry.map((g: any) => [g.lon, g.lat]);
      if (coords.length < 2) continue;
      const isRailway = el.tags?.railway === "rail";
      const tag = isRailway ? el.tags.railway : el.tags.highway;
      ways.push({ type: isRailway ? "railway" : "highway", tag, coords });
    }
    return ways;
  } catch {
    return [];
  }
}

/** Get bounding box of a route geometry with padding */
function getRouteBbox(routeGeometry: any, padDeg = 0.005): { minLat: number; minLng: number; maxLat: number; maxLng: number } {
  const coords: number[][] = [];
  const geo = typeof routeGeometry === "string" ? JSON.parse(routeGeometry) : routeGeometry;
  if (geo.type === "LineString") coords.push(...geo.coordinates);
  else if (geo.type === "MultiLineString") for (const l of geo.coordinates) coords.push(...l);
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const c of coords) {
    if (c[1] < minLat) minLat = c[1];
    if (c[1] > maxLat) maxLat = c[1];
    if (c[0] < minLng) minLng = c[0];
    if (c[0] > maxLng) maxLng = c[0];
  }
  return { minLat: minLat - padDeg, minLng: minLng - padDeg, maxLat: maxLat + padDeg, maxLng: maxLng + padDeg };
}

/** Find intersection point between two segments, returns [lng, lat] or null */
function segmentIntersectionPoint(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number
): [number, number] | null {
  const d = (ax2 - ax1) * (by2 - by1) - (ay2 - ay1) * (bx2 - bx1);
  if (Math.abs(d) < 1e-10) return null;
  const t = ((bx1 - ax1) * (by2 - by1) - (by1 - ay1) * (bx2 - bx1)) / d;
  const u = ((bx1 - ax1) * (ay2 - ay1) - (by1 - ay1) * (ax2 - ax1)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [ax1 + t * (ax2 - ax1), ay1 + t * (ay2 - ay1)];
}

/** Check minimum distance from a point to any segment of a linestring (in meters) */
function pointToSegmentDistanceMeters(
  ptLng: number,
  ptLat: number,
  aLng: number,
  aLat: number,
  bLng: number,
  bLat: number
): number {
  const latRad = (ptLat * Math.PI) / 180;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(latRad);

  const ax = (aLng - ptLng) * mPerDegLng;
  const ay = (aLat - ptLat) * mPerDegLat;
  const bx = (bLng - ptLng) * mPerDegLng;
  const by = (bLat - ptLat) * mPerDegLat;

  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;

  if (ab2 <= 1e-9) return Math.hypot(ax, ay);

  const t = Math.max(0, Math.min(1, (-(ax * abx + ay * aby)) / ab2));
  const px = ax + t * abx;
  const py = ay + t * aby;
  return Math.hypot(px, py);
}

function segmentBearingDeg(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const angle = Math.atan2(lat2 - lat1, lng2 - lng1) * (180 / Math.PI);
  return (angle + 360) % 360;
}

function bearingDeltaDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  const normalized = diff > 180 ? 360 - diff : diff;
  return normalized > 90 ? 180 - normalized : normalized;
}

function nearestLineSegmentInfo(
  ptLng: number,
  ptLat: number,
  lineCoords: number[][]
): { distanceM: number; segmentBearingDeg: number } {
  let minDist = Infinity;
  let bestBearing = 0;

  for (let i = 0; i < lineCoords.length - 1; i++) {
    const [aLng, aLat] = lineCoords[i];
    const [bLng, bLat] = lineCoords[i + 1];
    const d = pointToSegmentDistanceMeters(ptLng, ptLat, aLng, aLat, bLng, bLat);
    if (d < minDist) {
      minDist = d;
      bestBearing = segmentBearingDeg(aLng, aLat, bLng, bLat);
    }
  }

  return { distanceM: minDist, segmentBearingDeg: bestBearing };
}

function minDistToLine(ptLng: number, ptLat: number, lineCoords: number[][]): number {
  if (lineCoords.length < 2) return Infinity;
  return nearestLineSegmentInfo(ptLng, ptLat, lineCoords).distanceM;
}

export interface HighwayRailwayCheckResult {
  blocked: boolean;
  type?: "highway" | "railway";
  message?: string;
}

/**
 * Check if a route crosses highways or railways WITHOUT an existing NTT cable at the crossing.
 * @param routeGeometry - OSRM route geometry (GeoJSON LineString)
 * @param overpassWays - highways/railways from Overpass API
 * @param nttCables - NTT cable LineStrings from geo_elements (properties.tipo === "CABO")
 * @param toleranceM - distance tolerance for NTT cable exception (default 100m)
 */
export function routeCrossesHighwayOrRailway(
  routeGeometry: any,
  overpassWays: OverpassWay[],
  nttCables: Array<{ coords: number[][] }>,
  toleranceM: number = 100
): HighwayRailwayCheckResult {
  if (!routeGeometry || overpassWays.length === 0) return { blocked: false };

  const geo = typeof routeGeometry === "string" ? JSON.parse(routeGeometry) : routeGeometry;
  const routeCoords: number[][] = [];
  if (geo.type === "LineString") routeCoords.push(...geo.coordinates);
  else if (geo.type === "MultiLineString") for (const l of geo.coordinates) routeCoords.push(...l);
  if (routeCoords.length < 2) return { blocked: false };

  for (const way of overpassWays) {
    // Check segment-by-segment intersection between route and this highway/railway
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const [rLng1, rLat1] = routeCoords[i];
      const [rLng2, rLat2] = routeCoords[i + 1];

      for (let j = 0; j < way.coords.length - 1; j++) {
        const [wLng1, wLat1] = way.coords[j];
        const [wLng2, wLat2] = way.coords[j + 1];

        const pt = segmentIntersectionPoint(rLng1, rLat1, rLng2, rLat2, wLng1, wLat1, wLng2, wLat2);
        if (!pt) continue;

        // Found intersection! Check if NTT cable also crosses here
        const [crossLng, crossLat] = pt;
        let nttHasCrossing = false;

        for (const cable of nttCables) {
          // Quick proximity check: is any cable point near the crossing?
          const closestDist = minDistToLine(crossLng, crossLat, cable.coords);
          if (closestDist > toleranceM) continue;

          // Detailed check: does this cable actually cross the same highway/railway way?
          for (let ci = 0; ci < cable.coords.length - 1; ci++) {
            const [cLng1, cLat1] = cable.coords[ci];
            const [cLng2, cLat2] = cable.coords[ci + 1];

            const cableCross = segmentIntersectionPoint(cLng1, cLat1, cLng2, cLat2, wLng1, wLat1, wLng2, wLat2);
            if (cableCross) {
              const distBetweenCrossings = haversineDistance(crossLat, crossLng, cableCross[1], cableCross[0]);
              if (distBetweenCrossings <= toleranceM) {
                nttHasCrossing = true;
                break;
              }
            }
          }
          if (nttHasCrossing) break;
        }

        if (!nttHasCrossing) {
          const label = way.type === "railway" ? "via férrea" : "rodovia";
          const motivo = way.type === "railway" ? "FERROVIA_PROIBIDA" : "RODOVIA_PROIBIDA";
          return {
            blocked: true,
            type: way.type,
            message: `INVIÁVEL NA REDE PRÓPRIA – Rota cruza ${label} (${way.tag}) sem cruzamento de cabo NTT existente. Motivo: ${motivo}`,
          };
        }
        // If NTT has crossing, this particular intersection is allowed — continue checking others
      }
    }

    // Also check "traveling along" — block only when route is effectively on the same road axis
    // (parallel nearby roads are allowed)
    let overlapDist = 0;
    for (let i = 1; i < routeCoords.length; i++) {
      const [prevLng, prevLat] = routeCoords[i - 1];
      const [rLng, rLat] = routeCoords[i];
      const routeSegDist = haversineDistance(prevLat, prevLng, rLat, rLng);
      const routeBearing = segmentBearingDeg(prevLng, prevLat, rLng, rLat);

      const nearest = nearestLineSegmentInfo(rLng, rLat, way.coords);
      const angleDelta = bearingDeltaDeg(routeBearing, nearest.segmentBearingDeg);

      // Consider "on road" only when very close to centerline and aligned with it
      const isOnSameAxis = nearest.distanceM <= 6 && angleDelta <= 12;

      if (isOnSameAxis) {
        overlapDist += routeSegDist;
      } else {
        overlapDist = 0;
      }

      if (overlapDist > 30) {
        // Check NTT cable exception for this stretch
        const midIdx = Math.max(0, i - Math.floor(overlapDist / 10));
        const [midLng, midLat] = routeCoords[midIdx];
        let nttCovers = false;
        for (const cable of nttCables) {
          if (minDistToLine(midLng, midLat, cable.coords) <= toleranceM) {
            nttCovers = true;
            break;
          }
        }
        if (!nttCovers) {
          const label = way.type === "railway" ? "via férrea" : "rodovia";
          const motivo = way.type === "railway" ? "FERROVIA_PROIBIDA" : "RODOVIA_PROIBIDA";
          return {
            blocked: true,
            type: way.type,
            message: `INVIÁVEL NA REDE PRÓPRIA – Rota trafega por ${label} (${way.tag}) por mais de 30m sem cabo NTT existente. Motivo: ${motivo}`,
          };
        }
      }
    }
  }

  return { blocked: false };
}

/** Extract NTT cable coordinates from geo_elements for highway/railway exception check */
export function extractNttCables(
  elements: Array<{ geometry: any; properties?: any }>
): Array<{ coords: number[][] }> {
  const cables: Array<{ coords: number[][] }> = [];
  for (const el of elements) {
    const props = (typeof el.properties === "string" ? JSON.parse(el.properties) : el.properties) || {};
    if (props.tipo !== "CABO") continue;
    const geo = typeof el.geometry === "string" ? JSON.parse(el.geometry) : el.geometry;
    if (geo?.type === "LineString") {
      cables.push({ coords: geo.coordinates });
    } else if (geo?.type === "MultiLineString") {
      for (const line of geo.coordinates) cables.push({ coords: line });
    }
  }
  return cables;
}

/** Full highway/railway check: fetch Overpass data + run intersection check */
export async function checkRouteHighwayRailway(
  routeGeometry: any,
  nttElements: Array<{ geometry: any; properties?: any }>
): Promise<HighwayRailwayCheckResult> {
  if (!routeGeometry) return { blocked: false };
  const bbox = getRouteBbox(routeGeometry);
  const [ways, cables] = await Promise.all([
    fetchHighwaysAndRailways(bbox.minLat, bbox.minLng, bbox.maxLat, bbox.maxLng),
    Promise.resolve(extractNttCables(nttElements)),
  ]);
  if (ways.length === 0) return { blocked: false };
  return routeCrossesHighwayOrRailway(routeGeometry, ways, cables);
}
