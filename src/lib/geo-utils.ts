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

/** Convert closed LineStrings to Polygons for filled rendering.
 *  Only converts lines that enclose a significant area (coverage "manchas"). */
export function closedLineToPolygon(geometry: any): any {
  if (!geometry) return geometry;
  if (geometry.type === "LineString" && isClosedLine(geometry.coordinates) && isSignificantPolygon(geometry.coordinates)) {
    return { type: "Polygon", coordinates: [geometry.coordinates] };
  }
  if (geometry.type === "MultiLineString") {
    const significant = geometry.coordinates.filter((line: number[][]) => isClosedLine(line) && isSignificantPolygon(line));
    const rest = geometry.coordinates.filter((line: number[][]) => !(isClosedLine(line) && isSignificantPolygon(line)));
    if (significant.length === 0) return geometry;
    if (rest.length === 0) {
      return { type: "MultiPolygon", coordinates: significant.map((ring: number[][]) => [ring]) };
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
  portaDisponivel: boolean;
  motivo: "mais_proximo" | "verde_mais_proximo" | "fallback_saturado";
  mensagem?: string;
}

/** Find the best TA (Terminal de Atendimento) for connection.
 *  Logic:
 *  1. Find nearest TA overall
 *  2. If nearest has porta_disponivel=true and distance<=limit → use it
 *  3. If nearest is saturated → find nearest green TA within limit
 *  4. If no green TA within limit → fallback to nearest (saturated) with warning
 */
export function findBestTA(
  lat: number,
  lng: number,
  elements: Array<{ geometry: any; provider_id: string; properties?: any }>,
  limitMeters: number,
  useSaturatedTa: boolean = false
): TAResult | null {
  // Filter only TA points
  const taElements: Array<{ lat: number; lng: number; nome: string; portaDisponivel: boolean; distance: number }> = [];

  for (const el of elements) {
    const props = (typeof el.properties === "string" ? JSON.parse(el.properties) : el.properties) || {};
    if (props.tipo !== "TA") continue;
    const geo = typeof el.geometry === "string" ? JSON.parse(el.geometry) : el.geometry;
    if (geo?.type !== "Point") continue;
    const [lng2, lat2] = geo.coordinates;
    const d = haversineDistance(lat, lng, lat2, lng2);
    taElements.push({
      lat: lat2,
      lng: lng2,
      nome: props.nome || "TA",
      portaDisponivel: useSaturatedTa ? true : (props.porta_disponivel === true),
      distance: d,
    });
  }

  if (taElements.length === 0) return null;

  // Sort by distance
  taElements.sort((a, b) => a.distance - b.distance);
  const nearest = taElements[0];

  // Case 1: nearest has porta disponível and within limit
  if (nearest.portaDisponivel && nearest.distance <= limitMeters) {
    return {
      distance: nearest.distance,
      point: [nearest.lat, nearest.lng],
      nome: nearest.nome,
      portaDisponivel: true,
      motivo: "mais_proximo",
    };
  }

  // Case 2: nearest is saturated → find nearest green within limit
  if (!nearest.portaDisponivel) {
    const greenTAs = taElements.filter(t => t.portaDisponivel && t.distance <= limitMeters);
    if (greenTAs.length > 0) {
      const bestGreen = greenTAs[0];
      return {
        distance: bestGreen.distance,
        point: [bestGreen.lat, bestGreen.lng],
        nome: bestGreen.nome,
        portaDisponivel: true,
        motivo: "verde_mais_proximo",
      };
    }

    // Case 3: no green TA within limit → fallback to nearest (saturated)
    return {
      distance: nearest.distance,
      point: [nearest.lat, nearest.lng],
      nome: nearest.nome,
      portaDisponivel: false,
      motivo: "fallback_saturado",
      mensagem: "O TA mais próximo está saturado (sem porta disponível). Para prosseguir, é necessária viabilidade real via equipe Delivery.",
    };
  }

  // Case: nearest has porta but exceeds limit
  // Find green within limit
  const greenWithinLimit = taElements.filter(t => t.portaDisponivel && t.distance <= limitMeters);
  if (greenWithinLimit.length > 0) {
    return {
      distance: greenWithinLimit[0].distance,
      point: [greenWithinLimit[0].lat, greenWithinLimit[0].lng],
      nome: greenWithinLimit[0].nome,
      portaDisponivel: true,
      motivo: "verde_mais_proximo",
    };
  }

  // All TAs exceed limit
  return {
    distance: nearest.distance,
    point: [nearest.lat, nearest.lng],
    nome: nearest.nome,
    portaDisponivel: nearest.portaDisponivel,
    motivo: "mais_proximo",
  };
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

/** Calculate route distance via OSRM.
 *  Tries both "foot" (bidirectional, shortest) and "car" (may have better road data) profiles,
 *  then picks the shortest route. This avoids cases where one profile takes a detour. */
export async function getRouteDistance(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<{ distance: number; geometry: any } | null> {
  const fetchRoute = async (profile: string) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/${profile}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.length > 0) {
        return { distance: data.routes[0].distance as number, geometry: data.routes[0].geometry };
      }
      return null;
    } catch {
      return null;
    }
  };

  try {
    const [footRoute, carRoute] = await Promise.all([
      fetchRoute("foot"),
      fetchRoute("driving"),
    ]);

    // Pick the shortest valid route
    const candidates = [footRoute, carRoute].filter(Boolean) as { distance: number; geometry: any }[];
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0];
  } catch {
    return null;
  }
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
