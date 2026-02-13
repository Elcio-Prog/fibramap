import { kml } from "@tmcw/togeojson";

export function parseKML(text: string): GeoJSON.FeatureCollection {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/xml");
  return kml(doc) as GeoJSON.FeatureCollection;
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

/** Geocode an address using Nominatim */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; display: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=br`
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
