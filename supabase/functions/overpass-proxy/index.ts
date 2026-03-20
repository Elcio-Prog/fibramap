const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

type OverpassWay = {
  type: "highway" | "railway";
  tag: string;
  coords: number[][];
};

type OverpassFetchResult = {
  ways: OverpassWay[];
  success: boolean;
};

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const cache = new Map<string, { ts: number; result: OverpassFetchResult }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(minLat: number, minLng: number, maxLat: number, maxLng: number) {
  return [minLat, minLng, maxLat, maxLng].map((v) => v.toFixed(5)).join(":");
}

async function fetchOverpass(minLat: number, minLng: number, maxLat: number, maxLng: number): Promise<OverpassFetchResult> {
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = `[out:json][timeout:20];(way["highway"~"^(motorway|trunk|motorway_link|trunk_link)$"](${bbox});way["railway"="rail"](${bbox}););out geom;`;

  for (const server of OVERPASS_SERVERS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);
      const res = await fetch(server, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "User-Agent": "Lovable-Overpass-Proxy/1.0",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`[overpass-proxy] ${server} returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      const ways: OverpassWay[] = [];

      for (const el of data.elements || []) {
        if (el.type !== "way" || !el.geometry) continue;
        const coords = el.geometry.map((g: { lon: number; lat: number }) => [g.lon, g.lat]);
        if (coords.length < 2) continue;
        const isRailway = el.tags?.railway === "rail";
        const tag = isRailway ? el.tags.railway : el.tags.highway;
        ways.push({ type: isRailway ? "railway" : "highway", tag, coords });
      }

      return { ways, success: true };
    } catch (error) {
      console.warn(`[overpass-proxy] ${server} failed`, error);
    }
  }

  return { ways: [], success: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const minLat = Number(body?.minLat);
    const minLng = Number(body?.minLng);
    const maxLat = Number(body?.maxLat);
    const maxLng = Number(body?.maxLng);

    if ([minLat, minLng, maxLat, maxLng].some((v) => Number.isNaN(v))) {
      return new Response(JSON.stringify({ error: "Invalid bounding box" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const key = cacheKey(minLat, minLng, maxLat, maxLng);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cached.result), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const result = await fetchOverpass(minLat, minLng, maxLat, maxLng);
    if (result.success) {
      cache.set(key, { ts: Date.now(), result });
    }

    for (const [cacheKeyValue, entry] of cache.entries()) {
      if (Date.now() - entry.ts > CACHE_TTL_MS) cache.delete(cacheKeyValue);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
