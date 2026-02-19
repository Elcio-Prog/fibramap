import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useComprasLM, CompraLM } from "@/hooks/useComprasLM";
import { haversineDistance } from "@/lib/geo-utils";
import { fetchCep } from "@/lib/cep-utils";
import { Search, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface PartnerMetrics {
  parceiro: string;
  count: number;
  avgValor: number;
  minValor: number;
  maxValor: number;
  avgBanda: number | null;
  avgPrecoPorMbps: number | null;
}

interface ResultWithDistance extends CompraLM {
  distanceM: number;
}

export default function RadiusSearch() {
  const [address, setAddress] = useState("");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(5);
  const [results, setResults] = useState<ResultWithDistance[] | null>(null);
  const [metrics, setMetrics] = useState<PartnerMetrics[]>([]);
  const [searchTab, setSearchTab] = useState("address");
  const [cep, setCep] = useState("");
  const [coordLat, setCoordLat] = useState("");
  const [coordLng, setCoordLng] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const { data: allData } = useComprasLM();

  const handleCepSearch = async () => {
    if (loadingCep) return;
    setLoadingCep(true);
    try {
      const data = await fetchCep(cep);
      if (!data) {
        toast.error("CEP não encontrado");
        return;
      }
      let results: any[] = [];
      // Step 1: structured search (only if logradouro is not empty)
      if (data.logradouro) {
        const params = new URLSearchParams({
          format: "json",
          street: data.logradouro,
          city: data.localidade,
          state: data.uf,
          country: "BR",
          limit: "1",
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
        results = await res.json();
      }
      // Step 2: search by postalcode
      if (results.length === 0) {
        const params2 = new URLSearchParams({
          format: "json",
          postalcode: data.cep.replace("-", ""),
          country: "BR",
          limit: "1",
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params2}`);
        results = await res.json();
      }
      // Step 3: free text with city/state
      if (results.length === 0) {
        const query = data.logradouro
          ? `${data.logradouro}, ${data.localidade}, ${data.uf}`
          : `${data.localidade}, ${data.uf}`;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`
        );
        results = await res.json();
      }
      // Step 4: search just by city name
      if (results.length === 0) {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&city=${encodeURIComponent(data.localidade)}&state=${encodeURIComponent(data.uf)}&country=BR&limit=1`
        );
        results = await res.json();
      }
      if (results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        setCenter({ lat, lng });
        const addr = `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}`;
        setAddress(addr);
        toast.success(`Endereço encontrado: ${addr}`);
      } else {
        toast.error("Não foi possível geocodificar o CEP");
      }
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCoordSearch = () => {
    const lat = parseFloat(coordLat);
    const lng = parseFloat(coordLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setCenter({ lat, lng });
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  };

  const analyze = () => {
    if (!center || !allData) return;
    const radiusM = radius * 1000;
    const filtered: ResultWithDistance[] = allData
      .filter(r => r.lat && r.lng)
      .map(r => ({
        ...r,
        distanceM: haversineDistance(center.lat, center.lng, r.lat!, r.lng!),
      }))
      .filter(r => r.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM);
    setResults(filtered);

    // Group by partner
    const groups: Record<string, CompraLM[]> = {};
    for (const r of filtered) {
      if (!groups[r.parceiro]) groups[r.parceiro] = [];
      groups[r.parceiro].push(r);
    }

    const m: PartnerMetrics[] = Object.entries(groups).map(([parceiro, items]) => {
      const valores = items.map(i => i.valor_mensal);
      const bandas = items.filter(i => i.banda_mbps).map(i => i.banda_mbps!);
      const precos = items.filter(i => i.banda_mbps && i.banda_mbps > 0).map(i => i.valor_mensal / i.banda_mbps!);
      return {
        parceiro,
        count: items.length,
        avgValor: valores.reduce((a, b) => a + b, 0) / valores.length,
        minValor: Math.min(...valores),
        maxValor: Math.max(...valores),
        avgBanda: bandas.length > 0 ? bandas.reduce((a, b) => a + b, 0) / bandas.length : null,
        avgPrecoPorMbps: precos.length > 0 ? precos.reduce((a, b) => a + b, 0) / precos.length : null,
      };
    }).sort((a, b) => b.count - a.count);

    setMetrics(m);
  };

  // Render map when results change
  useEffect(() => {
    if (!results || !center || !mapRef.current) return;
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }

    const map = L.map(mapRef.current).setView([center.lat, center.lng], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OSM",
    }).addTo(map);

    // Draw circle
    L.circle([center.lat, center.lng], { radius: radius * 1000, color: "#3388ff", fillOpacity: 0.1 }).addTo(map);

    // Center marker
    L.marker([center.lat, center.lng]).addTo(map).bindPopup("Centro da busca");

    // Partner colors
    const colors = ["#e74c3c", "#2ecc71", "#3498db", "#f39c12", "#9b59b6", "#1abc9c", "#e67e22", "#34495e"];
    const partnerColors: Record<string, string> = {};
    let ci = 0;

    for (const r of results) {
      if (!r.lat || !r.lng) continue;
      if (!partnerColors[r.parceiro]) { partnerColors[r.parceiro] = colors[ci % colors.length]; ci++; }
      const color = partnerColors[r.parceiro];
      const dist = haversineDistance(center.lat, center.lng, r.lat, r.lng);
      const distLabel = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist.toFixed(0)} m`;
      L.circleMarker([r.lat, r.lng], {
        radius: 6, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9,
      }).addTo(map).bindPopup(
        `<b>${r.parceiro}</b><br/>${r.cliente || ""}<br/>R$ ${r.valor_mensal.toFixed(2)}${r.banda_mbps ? `<br/>${r.banda_mbps} Mbps` : ""}<br/><b>Distância: ${distLabel}</b>`
      );
    }

    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, [results, center, radius]);

  const totalConexoes = results?.length || 0;
  const avgValor = results && results.length > 0 ? results.reduce((a, r) => a + r.valor_mensal, 0) / results.length : 0;
  const minValor = results && results.length > 0 ? Math.min(...results.map(r => r.valor_mensal)) : 0;
  const maxValor = results && results.length > 0 ? Math.max(...results.map(r => r.valor_mensal)) : 0;
  const bandas = results?.filter(r => r.banda_mbps) || [];
  const avgBanda = bandas.length > 0 ? bandas.reduce((a, r) => a + r.banda_mbps!, 0) / bandas.length : null;
  const precosMbps = results?.filter(r => r.banda_mbps && r.banda_mbps > 0).map(r => r.valor_mensal / r.banda_mbps!) || [];
  const avgPrecoMbps = precosMbps.length > 0 ? precosMbps.reduce((a, b) => a + b, 0) / precosMbps.length : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" /> Pesquisa por Raio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={searchTab} onValueChange={setSearchTab}>
          <TabsList className="w-full">
            <TabsTrigger value="address" className="flex-1">Endereço</TabsTrigger>
            <TabsTrigger value="cep" className="flex-1">CEP</TabsTrigger>
            <TabsTrigger value="coords" className="flex-1">Coordenadas</TabsTrigger>
          </TabsList>
          <TabsContent value="address" className="mt-2">
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              onSelect={r => setCenter({ lat: r.lat, lng: r.lng })}
              placeholder="Endereço do centro da busca..."
            />
          </TabsContent>
          <TabsContent value="cep" className="mt-2">
            <div className="flex gap-2">
              <Input
                placeholder="Digite o CEP (ex: 13015-100)"
                value={cep}
                onChange={e => setCep(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCepSearch()}
              />
              <Button onClick={handleCepSearch} disabled={loadingCep} size="sm">
                {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="coords" className="mt-2">
            <div className="flex gap-2">
              <Input
                placeholder="Latitude (ex: -22.9068)"
                value={coordLat}
                onChange={e => setCoordLat(e.target.value)}
                type="number"
                step="any"
              />
              <Input
                placeholder="Longitude (ex: -47.0616)"
                value={coordLng}
                onChange={e => setCoordLng(e.target.value)}
                type="number"
                step="any"
              />
              <Button onClick={handleCoordSearch} size="sm">OK</Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Raio: {radius} km</label>
          <Slider min={1} max={50} step={1} value={[radius]} onValueChange={([v]) => setRadius(v)} />
        </div>

        <Button onClick={analyze} disabled={!center} className="w-full gap-2">
          <MapPin className="h-4 w-4" /> Analisar
        </Button>

        {results && (
          <>
            {/* Map */}
            <div ref={mapRef} className="h-64 rounded-lg border" />

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border p-2 text-center">
                <div className="text-muted-foreground text-xs">Conexões</div>
                <div className="font-bold text-lg">{totalConexoes}</div>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <div className="text-muted-foreground text-xs">Parceiros</div>
                <div className="font-bold text-lg">{metrics.length}</div>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <div className="text-muted-foreground text-xs">Média mensal</div>
                <div className="font-bold">R$ {avgValor.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <div className="text-muted-foreground text-xs">Mín / Máx</div>
                <div className="font-bold text-xs">R$ {minValor.toFixed(0)} — R$ {maxValor.toFixed(0)}</div>
              </div>
              {avgBanda !== null && (
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-muted-foreground text-xs">Média banda</div>
                  <div className="font-bold">{avgBanda.toFixed(0)} Mbps</div>
                </div>
              )}
              {avgPrecoMbps !== null && (
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-muted-foreground text-xs">R$/Mbps médio</div>
                  <div className="font-bold">R$ {avgPrecoMbps.toFixed(2)}</div>
                </div>
              )}
            </div>

            {/* Table by partner */}
            {metrics.length > 0 && (
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-left">
                      <th className="px-3 py-2">Parceiro</th>
                      <th className="px-3 py-2 text-right">Qtd</th>
                      <th className="px-3 py-2 text-right">Média</th>
                      <th className="px-3 py-2 text-right">Mín</th>
                      <th className="px-3 py-2 text-right">Máx</th>
                      <th className="px-3 py-2 text-right">R$/Mbps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map(m => (
                      <tr key={m.parceiro} className="border-t">
                        <td className="px-3 py-1.5">{m.parceiro}</td>
                        <td className="px-3 py-1.5 text-right">{m.count}</td>
                        <td className="px-3 py-1.5 text-right">R$ {m.avgValor.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right">R$ {m.minValor.toFixed(0)}</td>
                        <td className="px-3 py-1.5 text-right">R$ {m.maxValor.toFixed(0)}</td>
                        <td className="px-3 py-1.5 text-right">{m.avgPrecoPorMbps ? `R$ ${m.avgPrecoPorMbps.toFixed(2)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Detailed results with distance */}
            {results.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-muted-foreground">Detalhamento por endereço (ordenado por distância)</h4>
                <div className="overflow-x-auto border rounded-md max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr className="bg-muted text-left">
                        <th className="px-2 py-1.5">Distância</th>
                        <th className="px-2 py-1.5">Parceiro</th>
                        <th className="px-2 py-1.5">Cliente</th>
                        <th className="px-2 py-1.5">Endereço</th>
                        <th className="px-2 py-1.5 text-right">Valor</th>
                        <th className="px-2 py-1.5 text-right">Banda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map(r => {
                        const d = r.distanceM ?? 0;
                        const distLabel = d >= 1000
                          ? `${(d / 1000).toFixed(1)} km`
                          : `${d.toFixed(0)} m`;
                        return (
                          <tr key={r.id} className="border-t">
                            <td className="px-2 py-1 font-medium whitespace-nowrap">{distLabel}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{r.parceiro}</td>
                            <td className="px-2 py-1 whitespace-nowrap">{r.cliente || "—"}</td>
                            <td className="px-2 py-1 max-w-[200px] truncate" title={r.endereco}>{r.endereco}</td>
                            <td className="px-2 py-1 text-right whitespace-nowrap">R$ {r.valor_mensal.toFixed(2)}</td>
                            <td className="px-2 py-1 text-right whitespace-nowrap">{r.banda_mbps ? `${r.banda_mbps} Mbps` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
