import { useState, useEffect, useRef, useCallback } from "react";
import { useCart, CartItem } from "@/contexts/CartContext";
import * as XLSX from "xlsx";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useProviders } from "@/hooks/useProviders";
import { useGeoElements } from "@/hooks/useGeoElements";
import { useLpuItems } from "@/hooks/useLpuItems";
import { useComprasLM, CompraLM } from "@/hooks/useComprasLM";
import { usePreProviders, useAllPreProviderCities } from "@/hooks/usePreProviders";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Slider } from "@/components/ui/slider";
import {
  geocodeAddress,
  haversineDistance,
  closedLineToPolygon,
} from "@/lib/geo-utils";
import { processWsSingleItem, type WsItemInput, type ViableOption, type PreProviderWithCities } from "@/lib/ws-feasibility-engine";
import { fetchCep } from "@/lib/cep-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Search, MapPin, Navigation, Hash, Loader2, Download,
  CheckCircle2, XCircle, Building2, ShoppingCart,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast as useToastSonner } from "@/hooks/use-toast";

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type SingleSearchOption = ViableOption;

interface RadiusResult {
  compra: CompraLM;
  distanceM: number;
}

export default function WsSingleSearch() {
  const { toast } = useToast();
  const { data: providers } = useProviders();
  const { data: allGeoElements } = useGeoElements();
  const { data: allLpuItems } = useLpuItems();
  const { data: comprasLM } = useComprasLM();
  const { data: preProviders } = usePreProviders();
  const { data: preProviderCities } = useAllPreProviderCities();

  const preProvidersWithCities: PreProviderWithCities[] = (preProviders || [])
    .filter(pp => pp.status === "pre_cadastro")
    .map(pp => ({
      id: pp.id,
      nome_fantasia: pp.nome_fantasia,
      has_cross_ntt: pp.has_cross_ntt,
      cities: (preProviderCities || [])
        .filter(c => c.pre_provider_id === pp.id)
        .map(c => ({ cidade: c.cidade, estado: c.estado })),
    }))
    .filter(pp => pp.cities.length > 0);

  // Input fields
  const [inputMode, setInputMode] = useState<"address" | "coords" | "cep">("address");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [coordLat, setCoordLat] = useState("");
  const [coordLng, setCoordLng] = useState("");
  const [cep, setCep] = useState("");
  const [cepAddress, setCepAddress] = useState("");
  const [cepNumber, setCepNumber] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepData, setCepData] = useState<{ logradouro: string; bairro: string; localidade: string; uf: string } | null>(null);
  const [resolvedGeo, setResolvedGeo] = useState<{ lat: number; lng: number; display: string } | null>(null);

  // WS extra fields
  const [cliente, setCliente] = useState("");
  const [designacao, setDesignacao] = useState("");
  const [tipoLink, setTipoLink] = useState("");
  const [velocidade, setVelocidade] = useState("");

  // Results
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<SingleSearchOption[]>([]);
  const [geoResult, setGeoResult] = useState<{ lat: number; lng: number; display: string } | null>(null);

  // Radius
  const [radius, setRadius] = useState(5);
  const [radiusResults, setRadiusResults] = useState<RadiusResult[] | null>(null);
  const [selectedOptionIdxs, setSelectedOptionIdxs] = useState<Set<number>>(new Set());

  const { addItems, isInCart, isSent } = useCart();
  // Map
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const mapLayers = useRef<L.LayerGroup | null>(null);

  const handleCepLookup = async (value: string) => {
    setCep(value);
    const clean = value.replace(/\D/g, "");
    if (clean.length === 8) {
      setCepLoading(true);
      const result = await fetchCep(clean);
      setCepLoading(false);
      if (result) {
        const fullAddr = `${result.logradouro}, ${result.bairro}, ${result.localidade} - ${result.uf}`;
        setCepAddress(fullAddr);
        setCepData({ logradouro: result.logradouro, bairro: result.bairro, localidade: result.localidade, uf: result.uf });
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
        setCepAddress("");
        setCepData(null);
      }
    }
  };

  const geocodeCepAddress = async (number?: string): Promise<{ lat: number; lng: number; display: string } | null> => {
    if (!cepData) return null;
    const street = number ? `${cepData.logradouro}, ${number}` : cepData.logradouro;
    const params = new URLSearchParams({ format: "json", street, city: cepData.localidade, state: cepData.uf, country: "BR", limit: "1" });
    let res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    let results = await res.json();
    if (results.length === 0) {
      const clean = cep.replace(/\D/g, "");
      const p2 = new URLSearchParams({ format: "json", postalcode: clean, country: "BR", limit: "1" });
      res = await fetch(`https://nominatim.openstreetmap.org/search?${p2}`);
      results = await res.json();
    }
    if (results.length === 0) {
      const q = `${cepData.logradouro}, ${cepData.localidade}, ${cepData.uf}`;
      res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=br`);
      results = await res.json();
    }
    if (results.length > 0) {
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), display: results[0].display_name || cepAddress };
    }
    return null;
  };

  const handleSearch = async () => {
    setLoading(true);
    setOptions([]);
    setRadiusResults(null);
    setGeoResult(null);
    setSelectedOptionIdxs(new Set());

    try {
      let geo: { lat: number; lng: number; display: string } | null = null;

      if (inputMode === "address") {
        if (resolvedGeo && !addressNumber) geo = resolvedGeo;
        else if (resolvedGeo && addressNumber) {
          const fullAddr = address.includes(addressNumber) ? address : `${address}, ${addressNumber}`;
          geo = await geocodeAddress(fullAddr);
          if (!geo) geo = resolvedGeo;
        } else if (address.trim()) {
          const fullAddr = addressNumber ? `${address}, ${addressNumber}` : address;
          geo = await geocodeAddress(fullAddr);
        }
      } else if (inputMode === "coords") {
        const lat = parseFloat(coordLat);
        const lng = parseFloat(coordLng);
        if (!isNaN(lat) && !isNaN(lng)) geo = { lat, lng, display: `${lat}, ${lng}` };
      } else if (inputMode === "cep") {
        if (cepData) geo = await geocodeCepAddress(cepNumber || undefined);
      }

      if (!geo) {
        toast({ title: "Endereço não encontrado", variant: "destructive" });
        setLoading(false);
        return;
      }

      setGeoResult(geo);

      if (!providers?.length || !allGeoElements?.length) {
        toast({ title: "Sem dados de rede carregados", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Resolve cidade/uf from available data
      let cidadeResolved: string | null = null;
      let ufResolved: string | null = null;
      if (inputMode === "cep" && cepData) {
        cidadeResolved = cepData.localidade;
        ufResolved = cepData.uf;
      } else {
        // Try to extract city from display_name (Nominatim format: "..., Cidade, Estado, ...")
        // Also try reverse geocoding to get city
        try {
          const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${geo.lat}&lon=${geo.lng}&zoom=10&addressdetails=1&accept-language=pt-BR`);
          const revData = await revRes.json();
          if (revData?.address) {
            cidadeResolved = revData.address.city || revData.address.town || revData.address.municipality || null;
            ufResolved = revData.address.state ? revData.address.state.substring(0, 2).toUpperCase() : null;
            // Get proper 2-letter UF code from ISO
            if (revData.address["ISO3166-2-lvl4"]) {
              ufResolved = revData.address["ISO3166-2-lvl4"].replace("BR-", "");
            }
          }
        } catch {}
      }

      const wsItem: WsItemInput = {
        id: `single-${Date.now()}`,
        designacao: designacao || null,
        cliente: cliente || null,
        tipo_link: tipoLink || null,
        velocidade_mbps: velocidade ? Number(velocidade) : null,
        endereco_a: geo.display,
        cidade_a: cidadeResolved,
        uf_a: ufResolved,
        lat_a: geo.lat,
        lng_a: geo.lng,
        endereco_b: null,
        cidade_b: null,
        uf_b: null,
        lat_b: null,
        lng_b: null,
        prazo_ativacao: null,
        is_l2l: false,
        l2l_suffix: null,
        l2l_pair_id: null,
        row_number: 1,
      };

      const wsResult = await processWsSingleItem(
        wsItem,
        { lat: geo.lat, lng: geo.lng, source: inputMode === "coords" ? "coordenada" : "endereco" },
        providers as any,
        allGeoElements as any,
        (allLpuItems || []) as any,
        (comprasLM || []) as any,
        preProvidersWithCities,
      );

      setOptions(wsResult.all_options as SingleSearchOption[]);

      // Radius search on LM base
      if (comprasLM) {
        const radiusM = radius * 1000;
        const filtered: RadiusResult[] = comprasLM
          .filter(c => c.lat != null && c.lng != null)
          .map(c => ({ compra: c, distanceM: haversineDistance(geo.lat, geo.lng, c.lat!, c.lng!) }))
          .filter(r => r.distanceM <= radiusM)
          .sort((a, b) => a.distanceM - b.distanceM);
        setRadiusResults(filtered);
      }

      if (wsResult.all_options.length === 0) {
        toast({ title: "Nenhuma opção viável encontrada" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Re-run radius when radius changes and we have a geo result
  useEffect(() => {
    if (!geoResult || !comprasLM) return;
    const radiusM = radius * 1000;
    const filtered: RadiusResult[] = comprasLM
      .filter(c => c.lat != null && c.lng != null)
      .map(c => ({ compra: c, distanceM: haversineDistance(geoResult.lat, geoResult.lng, c.lat!, c.lng!) }))
      .filter(r => r.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM);
    setRadiusResults(filtered);
  }, [radius, geoResult, comprasLM]);

  // Map rendering
  useEffect(() => {
    if (!geoResult || !mapRef.current) return;

    // Destroy previous map to avoid stale state
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
      mapLayers.current = null;
    }

    const container = mapRef.current as HTMLDivElement & { _leaflet_id?: number };
    if (container._leaflet_id) container._leaflet_id = undefined;
    const map = L.map(container, { maxZoom: 50 }).setView([geoResult.lat, geoResult.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxNativeZoom: 19, maxZoom: 50 }).addTo(map);
    mapLayers.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    const layerGroup = mapLayers.current;
    if (!layerGroup) return;

    const bounds = L.latLngBounds([[geoResult.lat, geoResult.lng]]);

    // Client marker
    L.marker([geoResult.lat, geoResult.lng]).addTo(layerGroup).bindPopup(`<b>Cliente</b><br/>${cliente || geoResult.display}`);

    // Radius circle
    L.circle([geoResult.lat, geoResult.lng], { radius: radius * 1000, color: "#3388ff", fillOpacity: 0.05, weight: 1, dashArray: "8 4" }).addTo(layerGroup);

    // Draw provider coverages near the point
    if (allGeoElements) {
      const maxRenderDist = 10000;
      const nearbyElements = allGeoElements.filter(el => {
        const rawGeo = typeof el.geometry === "string" ? JSON.parse(el.geometry) : el.geometry;
        if (!rawGeo?.coordinates) return false;
        let sampleCoord: number[] | null = null;
        if (rawGeo.type === "Point") sampleCoord = rawGeo.coordinates;
        else if (rawGeo.type === "Polygon") sampleCoord = rawGeo.coordinates?.[0]?.[0];
        else if (rawGeo.type === "MultiPolygon") sampleCoord = rawGeo.coordinates?.[0]?.[0]?.[0];
        else if (rawGeo.type === "LineString") sampleCoord = rawGeo.coordinates?.[0];
        if (!sampleCoord) return false;
        return haversineDistance(geoResult.lat, geoResult.lng, sampleCoord[1], sampleCoord[0]) <= maxRenderDist;
      });

      for (const el of nearbyElements) {
        try {
          const rawGeo = typeof el.geometry === "string" ? JSON.parse(el.geometry) : el.geometry;
          const geo = closedLineToPolygon(rawGeo);
          const props = (typeof el.properties === "string" ? JSON.parse(el.properties) : el.properties) || {};
          const provider = providers?.find(p => p.id === el.provider_id);
          const color = provider?.color || "#3388ff";

          if (geo.type === "Point") {
            const pt: [number, number] = [geo.coordinates[1], geo.coordinates[0]];
            if (props.tipo === "TA") {
              const taAvailable = props.porta_disponivel === true;
              L.circleMarker(pt, { radius: 4, fillColor: taAvailable ? "#22c55e" : "#1a1a1a", color: "#fff", weight: 1.5, fillOpacity: 0.95 })
                .addTo(layerGroup).bindTooltip(`<b>${props.nome || "TA"}</b><br/>${taAvailable ? "🟢 Disponível" : "⚫ Saturado"}`, { sticky: true });
            } else if (props.tipo === "CE") {
              L.circleMarker(pt, { radius: 3, fillColor: "#f59e0b", color: "#fff", weight: 1, fillOpacity: 0.85 })
                .addTo(layerGroup).bindTooltip(`<b>${props.nome || "CE"}</b>`, { sticky: true });
            }
          } else {
            const isCPFL = props.tipo === "EXCLUSAO_CPFL";
            L.geoJSON({ type: "Feature", geometry: geo, properties: props } as any, {
              style: () => ({
                color: isCPFL ? "#ef4444" : color,
                weight: isCPFL ? 2 : 2,
                opacity: 0.7,
                fillColor: isCPFL ? "#ef4444" : color,
                fillOpacity: (geo.type === "Polygon" || geo.type === "MultiPolygon") ? 0.2 : 0.15,
                dashArray: isCPFL ? "8 4" : undefined,
              }),
            }).addTo(layerGroup);
          }
        } catch {}
      }
    }

    // Draw routes from options
    for (const opt of options) {
      if (opt.nearest_point) {
        const routeColor = opt.is_own_network ? "#3b82f6" : "#22c55e";
        // Draw route line only when we have real road geometry
        if (opt.route_geometry) {
          try {
            const geojsonData = opt.route_geometry.type === "Feature" || opt.route_geometry.type === "FeatureCollection"
              ? opt.route_geometry
              : { type: "Feature", geometry: opt.route_geometry, properties: {} };
            L.geoJSON(geojsonData, {
              style: () => ({ color: routeColor, weight: 4, opacity: 0.8, dashArray: "10 6" }),
            }).addTo(layerGroup);
          } catch {}
        }
        // Connection point marker
        L.circleMarker(opt.nearest_point, { radius: 6, fillColor: routeColor, color: "#fff", weight: 2, fillOpacity: 0.9 })
          .addTo(layerGroup).bindPopup(`<b>${opt.provider_name}</b><br/>${opt.stage} - ${opt.distance_m}m<br/>${opt.ta_info || ""}`);
        bounds.extend(L.latLng(opt.nearest_point[0], opt.nearest_point[1]));
      }
    }

    // Draw LM radius results
    if (radiusResults) {
      const colors = ["#e74c3c", "#2ecc71", "#3498db", "#f39c12", "#9b59b6", "#1abc9c"];
      const partnerColors: Record<string, string> = {};
      let ci = 0;
      for (const r of radiusResults) {
        if (!r.compra.lat || !r.compra.lng) continue;
        if (!partnerColors[r.compra.parceiro]) { partnerColors[r.compra.parceiro] = colors[ci % colors.length]; ci++; }
        const c = partnerColors[r.compra.parceiro];
        const distLabel = r.distanceM >= 1000 ? `${(r.distanceM / 1000).toFixed(1)} km` : `${r.distanceM.toFixed(0)} m`;
        L.circleMarker([r.compra.lat, r.compra.lng], { radius: 5, fillColor: c, color: "#fff", weight: 1.5, fillOpacity: 0.85 })
          .addTo(layerGroup).bindPopup(
            `<b>${r.compra.parceiro}</b><br/>${r.compra.cliente || ""}<br/>R$ ${r.compra.valor_mensal.toFixed(2)}${r.compra.banda_mbps ? `<br/>${r.compra.banda_mbps} Mbps` : ""}<br/><b>${distLabel}</b>`
          );
      }
    }

    // Extend bounds to include radius circle
    const radiusM = radius * 1000;
    const latOffset = radiusM / 111320;
    const lngOffset = radiusM / (111320 * Math.cos(geoResult.lat * Math.PI / 180));
    bounds.extend(L.latLng(geoResult.lat + latOffset, geoResult.lng + lngOffset));
    bounds.extend(L.latLng(geoResult.lat - latOffset, geoResult.lng - lngOffset));

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 300);
    setTimeout(() => map.invalidateSize(), 600);
  }, [geoResult, options, radiusResults, radius, allGeoElements, providers]);

  useEffect(() => {
    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
      mapLayers.current = null;
    };
  }, []);

  const exportToExcel = () => {
    if (!geoResult || (options.length === 0 && (!radiusResults || radiusResults.length === 0))) return;

    // Determine max LM results to create columns
    const maxLM = radiusResults?.length || 0;

    // Build a single row with all viability options as columns + LM radius as columns
    const row: Record<string, any> = {
      "Designação": designacao || "",
      "Cliente": cliente || "",
      "Tipo Link": tipoLink || "",
      "Vel. (Mbps)": velocidade || "",
      "Endereço": geoResult.display,
      "Lat": geoResult.lat,
      "Lng": geoResult.lng,
    };

    // Add viability options as columns
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      const prefix = `Opção ${i + 1}`;
      row[`${prefix} - Etapa`] = o.is_blocked ? `${o.stage} (INVIÁVEL)` : o.is_check_om ? `${o.stage} (Checar O&M)` : o.stage;
      row[`${prefix} - Provedor`] = o.provider_name;
      row[`${prefix} - Distância (m)`] = o.distance_m;
      row[`${prefix} - Valor LPU`] = o.lpu_value ?? "";
      row[`${prefix} - Valor Final`] = o.final_value ?? "";
      row[`${prefix} - TA/CE`] = o.ta_info || "";
      row[`${prefix} - Obs`] = o.notes;
    }

    // Viability summary
    const nonBlocked = options.filter(o => !o.is_blocked && !o.is_check_om);
    const checkOm = options.filter(o => o.is_check_om);
    row["Viável"] = nonBlocked.length > 0 ? "SIM" : checkOm.length > 0 ? "Checar O&M disponibilidade" : "NÃO";

    // Add LM radius results as columns on the same row
    if (radiusResults && radiusResults.length > 0) {
      for (let i = 0; i < radiusResults.length; i++) {
        const r = radiusResults[i];
        const prefix = `LM ${i + 1}`;
        const distLabel = r.distanceM >= 1000 ? `${(r.distanceM / 1000).toFixed(1)} km` : `${r.distanceM.toFixed(0)} m`;
        row[`${prefix} - Parceiro`] = r.compra.parceiro;
        row[`${prefix} - Cliente`] = r.compra.cliente || "";
        row[`${prefix} - Endereço`] = r.compra.endereco;
        row[`${prefix} - Valor Mensal`] = r.compra.valor_mensal;
        row[`${prefix} - Banda (Mbps)`] = r.compra.banda_mbps ?? "";
        row[`${prefix} - Status`] = r.compra.status;
        row[`${prefix} - Distância`] = distLabel;
      }
    }

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet([row]);
    ws1["!cols"] = Object.keys(row).map(key => ({ wch: Math.max(key.length + 2, 15) }));
    XLSX.utils.book_append_sheet(wb, ws1, "Viabilidade");

    XLSX.writeFile(wb, `ws_busca_${designacao || "single"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Radius metrics
  const radiusPartners: Record<string, number> = {};
  radiusResults?.forEach(r => { radiusPartners[r.compra.parceiro] = (radiusPartners[r.compra.parceiro] || 0) + 1; });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Busca Unitária</h1>

      {/* Input Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Dados da Consulta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* WS fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Cliente</Label>
              <Input placeholder="Nome do cliente" value={cliente} onChange={e => setCliente(e.target.value)} />
            </div>
            <div>
              <Label>Designação</Label>
              <Input placeholder="CNS000..." value={designacao} onChange={e => setDesignacao(e.target.value)} />
            </div>
            <div>
              <Label>Tipo Link</Label>
              <Input placeholder="FO, Rádio..." value={tipoLink} onChange={e => setTipoLink(e.target.value)} />
            </div>
            <div>
              <Label>Velocidade (Mbps)</Label>
              <Input type="number" placeholder="100" value={velocidade} onChange={e => setVelocidade(e.target.value)} />
            </div>
          </div>

          {/* Address input */}
          <Tabs value={inputMode} onValueChange={v => setInputMode(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="address" className="flex-1 gap-1"><MapPin className="h-3.5 w-3.5" /> Endereço</TabsTrigger>
              <TabsTrigger value="coords" className="flex-1 gap-1"><Navigation className="h-3.5 w-3.5" /> Coordenadas</TabsTrigger>
              <TabsTrigger value="cep" className="flex-1 gap-1"><Hash className="h-3.5 w-3.5" /> CEP</TabsTrigger>
            </TabsList>
            <TabsContent value="address" className="mt-3 space-y-2">
              <AddressAutocomplete
                value={address}
                onChange={val => { setAddress(val); setResolvedGeo(null); }}
                onSelect={r => { setAddress(r.address); setResolvedGeo({ lat: r.lat, lng: r.lng, display: r.address }); }}
                placeholder="Ex: Rua Sergio Potulski, Sumaré - SP"
              />
              <div className="w-32">
                <Label>Número</Label>
                <Input placeholder="243" value={addressNumber} onChange={e => setAddressNumber(e.target.value)} />
              </div>
            </TabsContent>
            <TabsContent value="coords" className="mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Latitude</Label><Input type="number" step="any" placeholder="-22.8231" value={coordLat} onChange={e => setCoordLat(e.target.value)} /></div>
                <div><Label>Longitude</Label><Input type="number" step="any" placeholder="-47.2668" value={coordLng} onChange={e => setCoordLng(e.target.value)} /></div>
              </div>
            </TabsContent>
            <TabsContent value="cep" className="mt-3 space-y-2">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input placeholder="13170-000" value={cep} onChange={e => handleCepLookup(e.target.value)} maxLength={9} />
                    {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="col-span-2"><Label>Endereço</Label><Input value={cepAddress} readOnly className="bg-muted" /></div>
              </div>
              <div className="w-32"><Label>Número</Label><Input placeholder="275" value={cepNumber} onChange={e => setCepNumber(e.target.value)} /></div>
            </TabsContent>
          </Tabs>

          {/* Radius control */}
          <div className="space-y-1">
            <Label className="text-sm">Raio de busca LM: {radius} km</Label>
            <Slider min={1} max={50} step={1} value={[radius]} onValueChange={([v]) => setRadius(v)} />
          </div>

          <Button onClick={handleSearch} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "Buscando..." : "Buscar Viabilidade"}
          </Button>
        </CardContent>
      </Card>

      {/* Map - always in DOM, hidden when no result */}
      <div
        ref={mapRef}
        className="rounded-lg border"
        style={{ height: geoResult ? "24rem" : "0", overflow: "hidden", transition: "height 0.3s" }}
      />

      {/* Results */}
      {options.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Opções de Viabilidade ({options.length})
              </span>
              <Button size="sm" className="gap-2" onClick={exportToExcel}>
                <Download className="h-4 w-4" /> Excel
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded-md">
              <table className="text-xs w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left">#</th>
                    <th className="px-2 py-1.5 text-left">Etapa</th>
                    <th className="px-2 py-1.5 text-left">Provedor</th>
                    <th className="px-2 py-1.5 text-right">Distância</th>
                    <th className="px-2 py-1.5 text-right">Valor LPU</th>
                    <th className="px-2 py-1.5 text-right">Valor Final</th>
                    <th className="px-2 py-1.5 text-left">TA/CE</th>
                    <th className="px-2 py-1.5 text-left">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {options.map((o, i) => (
                    <tr key={i} className={`border-t ${o.is_check_om ? "bg-yellow-50 dark:bg-yellow-900/10" : o.is_blocked ? "bg-destructive/5" : ""}`}>
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1">
                        {o.is_check_om ? (
                          <Badge variant="outline" className="text-[10px] border-yellow-400 text-yellow-700 dark:text-yellow-400">Checar O&M</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{o.stage}</Badge>
                        )}
                      </td>
                      <td className="px-2 py-1 flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.provider_color }} />
                        {o.provider_name}
                        {o.has_cross_ntt && <Building2 className="h-3 w-3 text-muted-foreground" />}
                      </td>
                      <td className="px-2 py-1 text-right">{o.distance_m}m</td>
                      <td className="px-2 py-1 text-right">{o.lpu_value != null ? `R$${o.lpu_value}` : "—"}</td>
                      <td className="px-2 py-1 text-right font-semibold">{o.final_value != null ? `R$${o.final_value}` : "—"}</td>
                      <td className="px-2 py-1 max-w-[120px] truncate">{o.ta_info || "—"}</td>
                      <td className="px-2 py-1 max-w-[200px] truncate text-muted-foreground">{o.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export button when no viability options but radius results exist */}
      {options.length === 0 && radiusResults && radiusResults.length > 0 && geoResult && (
        <div className="flex justify-end">
          <Button size="sm" className="gap-2" onClick={exportToExcel}>
            <Download className="h-4 w-4" /> Exportar Excel
          </Button>
        </div>
      )}

      {/* Radius LM results */}
      {radiusResults && radiusResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Base LM no Raio ({radiusResults.length} conexões, {Object.keys(radiusPartners).length} parceiros)</span>
              {options.length > 0 && (
                <Button size="sm" variant="outline" className="gap-2" onClick={exportToExcel}>
                  <Download className="h-4 w-4" /> Excel Completo
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(radiusPartners).sort((a, b) => b[1] - a[1]).map(([p, c]) => (
                <Badge key={p} variant="outline" className="text-xs">{p}: {c}</Badge>
              ))}
            </div>
            <div className="overflow-x-auto max-h-64 border rounded-md overflow-y-auto">
              <table className="text-xs w-full">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Distância</th>
                    <th className="px-2 py-1.5 text-left">Parceiro</th>
                    <th className="px-2 py-1.5 text-left">Cliente</th>
                    <th className="px-2 py-1.5 text-left">Endereço</th>
                    <th className="px-2 py-1.5 text-right">Valor</th>
                    <th className="px-2 py-1.5 text-right">Banda</th>
                  </tr>
                </thead>
                <tbody>
                  {radiusResults.slice(0, 100).map((r, i) => {
                    const d = r.distanceM;
                    const distLabel = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d.toFixed(0)} m`;
                    return (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 font-mono">{distLabel}</td>
                        <td className="px-2 py-1">{r.compra.parceiro}</td>
                        <td className="px-2 py-1 max-w-[100px] truncate">{r.compra.cliente || "—"}</td>
                        <td className="px-2 py-1 max-w-[150px] truncate">{r.compra.endereco}</td>
                        <td className="px-2 py-1 text-right">R$ {r.compra.valor_mensal.toFixed(2)}</td>
                        <td className="px-2 py-1 text-right">{r.compra.banda_mbps ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {geoResult && options.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground flex items-center justify-center gap-2">
            <XCircle className="h-4 w-4" /> Nenhuma opção viável encontrada para este endereço.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
