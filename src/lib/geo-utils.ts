import { kml } from "@tmcw/togeojson";
import JSZip from "jszip";

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

/** Extract all polygons from a geometry as arrays of [lng, lat] rings */
function extractPolygonRings(geometry: any): [number, number][][] {
  if (!geometry) return [];
  switch (geometry.type) {
    case "Polygon":
      return geometry.coordinates.map((ring: [number, number][]) => ring);
    case "MultiPolygon":
      return geometry.coordinates.flat().map((ring: [number, number][]) => ring);
    default:
      return [];
  }
}

/** Ray-casting point-in-polygon test. Point is [lng, lat], ring is array of [lng, lat]. */
function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Check if a lat/lng point is inside any polygon of the given geo elements */
export function isInsideCoverage(
  lat: number,
  lng: number,
  elements: Array<{ geometry: any }>
): boolean {
  for (const el of elements) {
    const rings = extractPolygonRings(el.geometry);
    for (const ring of rings) {
      if (pointInRing(lng, lat, ring)) return true;
    }
  }
  return false;
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

/** Calculate route distance via OSRM */
export async function getRouteDistance(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<{ distance: number; geometry: any } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.length > 0) {
      return {
        distance: data.routes[0].distance,
        geometry: data.routes[0].geometry,
      };
    }
    return null;
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
  // Remove CEP patterns: 13.300-065, 13300-065, 13300065, CEP 13.300-065, CEP: 13300065
  clean = clean.replace(/,?\s*CEP[:\s]?\s*\d{2}\.?\d{3}-?\d{3}/gi, "");
  clean = clean.replace(/,?\s*\d{2}\.\d{3}-\d{3}/g, "");
  clean = clean.replace(/,?\s*\d{5}-\d{3}/g, "");
  clean = clean.replace(/,?\s*\d{8}\b/g, "");
  // Remove parenthetical notes like (Shopping Iguatemi), - ANEXO A, Protocolo XXXX
  clean = clean.replace(/\([^)]*\)/g, "");
  clean = clean.replace(/[-–]\s*ANEXO\s*\w*/gi, "");
  clean = clean.replace(/[-–]?\s*Protocolo\s*\d*/gi, "");
  // Remove "Endereco (A)...\nEndereço (B)..." → keep only first address line
  if (/Endere[çc]o\s*\(B\)/i.test(clean)) {
    clean = clean.replace(/\r?\nEndere[çc]o\s*\(B\).*$/gis, "");
    clean = clean.replace(/^Endere[çc]o\s*\(A\)\s*/i, "");
  }
  // Remove "ID XXXX - " prefixes
  clean = clean.replace(/ID\s*\d+\s*[-–]\s*/gi, "");
  // Remove "Número:" prefix (e.g. "MendesNúmero: 451" → "Mendes 451")
  clean = clean.replace(/N[úu]mero:\s*/gi, " ");
  // Remove "SEQ ...: NNNN -" prefixes (e.g. "SEQ BRADESCO: 2166 -")
  clean = clean.replace(/SEQ\s+[^:]+:\s*\d+\s*[-–]\s*/gi, "");
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
  // Remove ordinal indicators (º, ª) attached to numbers or words
  clean = clean.replace(/[º°ª]/g, "");
  // Replace / with , for city/state (e.g. CAMPINAS/SP -> CAMPINAS, SP)
  clean = clean.replace(/\/([A-Z]{2})\b/g, ", $1");
  // Remove S/Nº
  clean = clean.replace(/,?\s*S\/N[º°]?\b/gi, "");
  // Remove "BAIRRO" prefix (Nominatim doesn't need it)
  clean = clean.replace(/\bBAIRRO\s+/gi, "");
  // Remove non-breaking spaces and extra whitespace
  clean = clean.replace(/\u00A0/g, " ");
  clean = clean.replace(/\s+/g, " ").trim();
  // Remove trailing commas/dashes
  clean = clean.replace(/[,\-–\s]+$/, "").trim();
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
  // Match patterns like "Cidade/SP", "Cidade - SP", "Cidade, SP", "CIDADE/SP", "CIDADE - SP"
  // Support both mixed case and ALL CAPS city names
  const m = address.match(/([A-ZÀ-Úa-zà-ú][A-Za-zÀ-ú]+(?:\s+[A-Za-zÀ-ú]+)*)\s*[/,\-–]\s*([A-Z]{2})\b/);
  if (m) return { city: m[1].trim(), uf: m[2] };
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
 * Geocode an address using Nominatim with multi-step fallback:
 * 1. Full cleaned address (free-text)
 * 2. Simplified address (no number/neighborhood)
 * 3. Structured search (street + city + state)
 * 4. City + UF only (at least pins in the right municipality)
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; display: string } | null> {
  const cleaned = cleanAddressForGeocoding(address);

  // Step 1: Full cleaned free-text
  let result = await nominatimSearch(cleaned);
  if (result) return result;

  // Step 2: Simplified (remove number and extra segments)
  const simplified = simplifyAddress(cleaned);
  if (simplified !== cleaned) {
    await new Promise(r => setTimeout(r, 1100));
    result = await nominatimSearch(simplified);
    if (result) return result;
  }

  // Step 3: Structured search with city/state
  const cityUf = extractCityUf(address);
  if (cityUf) {
    // Try street + city + state
    const streetMatch = cleaned.match(/^((?:Avenida|Rua|Rodovia|Alameda|Travessa|Praça|Estrada)\s+[^,]+)/i);
    if (streetMatch) {
      await new Promise(r => setTimeout(r, 1100));
      result = await nominatimStructured({ street: streetMatch[1], city: cityUf.city, state: cityUf.uf });
      if (result) return result;
    }

    // Step 4: Just city + UF
    await new Promise(r => setTimeout(r, 1100));
    result = await nominatimStructured({ city: cityUf.city, state: cityUf.uf });
    if (result) return result;
  }

  return null;
}
