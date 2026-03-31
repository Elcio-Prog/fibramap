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
import { processWsSingleItem, buildElementsByProvider, type WsItemInput, type ViableOption, type PreProviderWithCities } from "@/lib/ws-feasibility-engine";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast as useToastSonner } from "@/hooks/use-toast";
import { useFormPrecificacao } from "@/hooks/useFormPrecificacao";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { VIGENCIA_OPTIONS, BLOCO_IP_OPTIONS, PRODUTO_LINK_OPTIONS, TECNOLOGIA_OPTIONS } from "@/lib/field-options";

// Per-row pricing parameters
interface RowPricingParams {
  produto: string;
  vigencia: string;
  taxaInstalacao: string;
  velocidade: string;
  blocoIp: string;
  tecnologia: string;
  cidadePontaA: string;
  cidadePontaB: string;
  qtdFibrasDarkFiber: string;
}

const defaultRowPricing: RowPricingParams = {
  produto: "NT LINK DEDICADO FULL",
  vigencia: "",
  taxaInstalacao: "0",
  velocidade: "",
  blocoIp: "",
  tecnologia: "GPON",
  cidadePontaA: "",
  cidadePontaB: "",
  qtdFibrasDarkFiber: "0",
};

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
  const { data: providers, isLoading: loadingProviders } = useProviders();
  const { data: allGeoElements, isLoading: loadingGeo } = useGeoElements();
  const { data: allLpuItems, isLoading: loadingLpu } = useLpuItems();
  const { data: comprasLM, isLoading: loadingLM } = useComprasLM();
  const { data: preProviders } = usePreProviders();
  const { data: preProviderCities } = useAllPreProviderCities();

  const dataLoading = loadingProviders || loadingGeo || loadingLpu || loadingLM;

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
  const tipoLink = "";
  const [velocidade, setVelocidade] = useState("");

  // Results
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<SingleSearchOption[]>([]);
  const [geoResult, setGeoResult] = useState<{ lat: number; lng: number; display: string } | null>(null);

  // Radius
  const [radius, setRadius] = useState(5);
  const [radiusResults, setRadiusResults] = useState<RadiusResult[] | null>(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);

  // Pricing parameters per row
  const { options: formOptions, loadingData: loadingFormData } = useFormPrecificacao();
  const [rowPricing, setRowPricing] = useState<Record<number, RowPricingParams>>({});
  const [rowValorMinimo, setRowValorMinimo] = useState<Record<number, number | null>>({});
  const [rowCalcLoading, setRowCalcLoading] = useState<Record<number, boolean>>({});
  const calcTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const getRowPricing = (idx: number): RowPricingParams => {
    return rowPricing[idx] ?? { ...defaultRowPricing, velocidade: velocidade || "" };
  };

  const setRowField = (idx: number, field: keyof RowPricingParams, value: string) => {
    setRowPricing(prev => ({
      ...prev,
      [idx]: { ...getRowPricing(idx), [field]: value },
    }));
  };

  // Auto-calculate valor mínimo when row pricing params change
  const calcularRow = useCallback(async (idx: number, params: RowPricingParams, distancia: number) => {
    setRowCalcLoading(prev => ({ ...prev, [idx]: true }));
    try {
      const isDarkFiber = params.produto === "NT DARK FIBER";
      const isL2L = params.produto === "NT L2L";
      const payload: Record<string, any> = {
        produto: "Conectividade" as const,
        subproduto: params.produto,
        vigencia: Number(params.vigencia) || 24,
        roiVigencia: 24,
        taxaInstalacao: Number(params.taxaInstalacao) || 0,
        custosMateriaisAdicionais: 0,
        projetoAvaliado: false,
        valorOpex: 0,
        rede: params.cidadePontaA || undefined,
        banda: isDarkFiber ? 0 : (Number(params.velocidade) || 0),
        distancia: distancia,
        togDistancia: true,
        blocoIp: (isL2L || isDarkFiber) ? undefined : (params.blocoIp || undefined),
        custoLastMile: 0,
        valorLastMile: 0,
        tecnologia: params.tecnologia || "GPON",
      };
      if (isDarkFiber) {
        payload.qtdFibrasDarkFiber = Number(params.qtdFibrasDarkFiber) || 0;
      }
      if (isL2L) {
        payload.redePontaB = params.cidadePontaB || undefined;
      }
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "calcular-precificacao",
        { body: payload }
      );
      if (fnError || result?.error) {
        setRowValorMinimo(prev => ({ ...prev, [idx]: null }));
      } else {
        setRowValorMinimo(prev => ({ ...prev, [idx]: result.valorMinimo }));
      }
    } catch {
      setRowValorMinimo(prev => ({ ...prev, [idx]: null }));
    } finally {
      setRowCalcLoading(prev => ({ ...prev, [idx]: false }));
    }
  }, []);

  // Trigger debounced recalc when rowPricing changes
  useEffect(() => {
    if (options.length === 0) return;
    for (const idxStr of Object.keys(rowPricing)) {
      const idx = Number(idxStr);
      const params = rowPricing[idx];
      const opt = options[idx];
      if (!opt || !params) continue;
      clearTimeout(calcTimers.current[idx]);
      calcTimers.current[idx] = setTimeout(() => {
        calcularRow(idx, params, opt.distance_m);
      }, 600);
    }
    return () => {
      Object.values(calcTimers.current).forEach(t => clearTimeout(t));
    };
  }, [rowPricing, options, calcularRow]);

  // Reset pricing state when options change
  useEffect(() => {
    setRowPricing({});
    setRowValorMinimo({});
    setRowCalcLoading({});
  }, [options]);

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

  const executeSearch = async (geo: { lat: number; lng: number; display: string }): Promise<{ options: SingleSearchOption[]; radiusResults: RadiusResult[] }> => {
    // Resolve cidade/uf from available data
    let cidadeResolved: string | null = null;
    let ufResolved: string | null = null;
    if (inputMode === "cep" && cepData) {
      cidadeResolved = cepData.localidade;
      ufResolved = cepData.uf;
    } else {
      try {
        const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${geo.lat}&lon=${geo.lng}&zoom=10&addressdetails=1&accept-language=pt-BR`);
        const revData = await revRes.json();
        if (revData?.address) {
          cidadeResolved = revData.address.city || revData.address.town || revData.address.municipality || null;
          ufResolved = revData.address.state ? revData.address.state.substring(0, 2).toUpperCase() : null;
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

    let radResults: RadiusResult[] = [];
    if (comprasLM) {
      const radiusM = radius * 1000;
      radResults = comprasLM
        .filter(c => c.lat != null && c.lng != null)
        .map(c => ({ compra: c, distanceM: haversineDistance(geo.lat, geo.lng, c.lat!, c.lng!) }))
        .filter(r => r.distanceM <= radiusM)
        .sort((a, b) => a.distanceM - b.distanceM);
    }

    return { options: wsResult.all_options as SingleSearchOption[], radiusResults: radResults };
  };

  const handleSearch = async () => {
    setLoading(true);
    setOptions([]);
    setRadiusResults(null);
    setGeoResult(null);
    setSelectedOptionIdx(null);

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

      if (!providers?.length || !allGeoElements?.length || !allLpuItems) {
        toast({ title: "Dados de rede ainda carregando, aguarde...", variant: "destructive" });
        setLoading(false);
        return;
      }

      // First attempt
      let result: { options: SingleSearchOption[]; radiusResults: RadiusResult[] };
      try {
        result = await executeSearch(geo);
      } catch (firstErr: any) {
        // Auto-retry once on network/fetch failures
        console.warn("Busca unitária: primeira tentativa falhou, retentando...", firstErr?.message);
        await new Promise(r => setTimeout(r, 1500));
        result = await executeSearch(geo);
      }

      // Auto-retry if NTT own network wasn't found or if validation hit a transient service issue
      const hasNttOption = result.options.some(o => o.is_own_network);
      const hasTransientOwnNetworkIssue = result.options.some(o =>
        o.is_own_network && /indisponível nesta tentativa|serviço indisponível|não foi possível verificar/i.test(o.notes)
      );

      if ((!hasNttOption || hasTransientOwnNetworkIssue) && result.options.length >= 0) {
        // Check if there are NTT elements nearby (straight-line) that should have been found
        const netTurboProvider = providers?.find(p => p.name.toLowerCase().includes("net turbo"));
        if (netTurboProvider) {
          const nttElements = (allGeoElements || []).filter(el => el.provider_id === netTurboProvider.id);
          const hasNearbyNttBox = nttElements.some(el => {
            const elGeo = typeof el.geometry === "string" ? JSON.parse(el.geometry as string) : el.geometry;
            if (elGeo?.type !== "Point") return false;
            const [eLng, eLat] = elGeo.coordinates;
            return haversineDistance(geo.lat, geo.lng, eLat, eLng) <= netTurboProvider.max_lpu_distance_m;
          });

          if (hasNearbyNttBox) {
            console.info("Busca unitária: caixas NTT próximas detectadas mas não encontradas na busca. Retentando...");
            await new Promise(r => setTimeout(r, 1200));
            const retryResult = await executeSearch(geo);
            const retryResolvedTransientIssue = !retryResult.options.some(o =>
              o.is_own_network && /indisponível nesta tentativa|serviço indisponível|não foi possível verificar/i.test(o.notes)
            );
            // Use retry result if it found NTT options, improved the transient state, or has more total options
            if (
              retryResult.options.some(o => o.is_own_network) ||
              retryResolvedTransientIssue ||
              retryResult.options.length > result.options.length
            ) {
              result = retryResult;
            }
          }
        }
      }

      setOptions(result.options);
      setRadiusResults(result.radiusResults);

      if (result.options.length === 0) {
        toast({ title: "Nenhuma opção viável encontrada" });
      }
    } catch (err: any) {
      toast({ title: "Erro na busca", description: "Falha na comunicação com serviços externos. Tente novamente.", variant: "destructive" });
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
        // Draw off-road segment: pin → snapped road point (gray dashed line)
        if (opt.snap_point) {
          L.polyline(
            [[geoResult.lat, geoResult.lng], [opt.snap_point[0], opt.snap_point[1]]],
            { color: "#6b7280", weight: 2, opacity: 0.7, dashArray: "4 6" }
          ).addTo(layerGroup);
        }
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
        // Draw off-road segment: box → snapped road point (gray dashed line)
        if (opt.dest_snap_point && opt.nearest_point) {
          L.polyline(
            [[opt.nearest_point[0], opt.nearest_point[1]], [opt.dest_snap_point[0], opt.dest_snap_point[1]]],
            { color: "#6b7280", weight: 2, opacity: 0.7, dashArray: "4 6" }
          ).addTo(layerGroup);
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
              <Label>Velocidade (Mbps)</Label>
              <Input type="number" min="0" placeholder="100" value={velocidade} onChange={e => { const v = e.target.value; if (v === "" || Number(v) >= 0) setVelocidade(v); }} />
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

           <Button onClick={handleSearch} disabled={loading || dataLoading} className="w-full gap-2">
             {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : dataLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
             {loading ? "Buscando..." : dataLoading ? "Carregando dados..." : "Buscar Viabilidade"}
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
              <div className="flex items-center gap-2">
                {selectedOptionIdx !== null && (
                  <Button size="sm" className="gap-2" onClick={() => {
                    if (!geoResult || selectedOptionIdx === null) return;
                    const o = options[selectedOptionIdx];
                    const cartId = `single-${Date.now()}-${selectedOptionIdx}`;

                    // Build observacoes_system with other options + LM results
                    const otherOptions = options
                      .filter((_, i) => i !== selectedOptionIdx)
                      .map(opt => {
                        const distLabel = opt.distance_m != null ? `${opt.distance_m}m` : "—";
                        const valLabel = opt.final_value != null ? `R$${opt.final_value}` : "—";
                        return `${opt.provider_name} (${opt.stage}) - ${distLabel} - ${valLabel}`;
                      });

                    const lmLines = (radiusResults || []).slice(0, 5).map(r => {
                      const d = r.distanceM;
                      const distLabel = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d.toFixed(0)} m`;
                      const parcNorm = r.compra.parceiro?.trim().toLowerCase() || "";
                      const matchedProv = (providers || []).find(p => {
                        const pn = p.name.trim().toLowerCase();
                        return parcNorm.includes(pn) || pn.includes(parcNorm);
                      });
                      const matchedPreProv = !matchedProv ? (preProviders || []).find(pp => {
                        const ppn = pp.nome_fantasia.trim().toLowerCase();
                        return parcNorm.includes(ppn) || ppn.includes(parcNorm);
                      }) : null;
                      const contactName = matchedProv?.gerente_comercial || matchedProv?.contato_noc_nome || matchedPreProv?.contato_comercial_nome || matchedPreProv?.contato_noc_nome || "";
                      const contactPhone = matchedProv?.telefone_gerente || matchedProv?.contato_noc_fone || matchedPreProv?.contato_comercial_fone || matchedPreProv?.contato_noc_fone || "";
                      const contactLabel = [contactName, contactPhone].filter(Boolean).join(" · ") || "—";
                      return `${r.compra.parceiro} - ${distLabel} - ${contactLabel}`;
                    });

                    let obsSystem = "";
                    if (otherOptions.length > 0) {
                      obsSystem += "Outras opções de Viabilidades:\n" + otherOptions.join("\n");
                    }
                    if (lmLines.length > 0) {
                      if (obsSystem) obsSystem += "\n\n";
                      obsSystem += "Base LM no Raio:\n" + lmLines.join("\n");
                    }

                    const rp = getRowPricing(selectedOptionIdx);
                    const lpu = o.final_value ?? 0;
                    const calc = rowValorMinimo[selectedOptionIdx] ?? 0;
                    const totalValorMinimo = lpu + calc;

                    const newItem: CartItem = {
                      id: cartId,
                      batchId: "single-search",
                      batchTitle: "Busca Unitária",
                      designacao: designacao || "",
                      cliente: cliente || "",
                      cnpj_cliente: "",
                      endereco: geoResult.display,
                      cidade: rp.cidadePontaA || "",
                      uf: "",
                      lat: geoResult.lat,
                      lng: geoResult.lng,
                      is_viable: !o.is_blocked,
                      is_check_om: o.is_check_om,
                      stage: o.stage,
                      provider_name: o.provider_name,
                      velocidade_mbps: rp.velocidade ? Number(rp.velocidade) : (velocidade ? Number(velocidade) : null),
                      velocidade_original: rp.velocidade || velocidade || "",
                      distance_m: o.distance_m,
                      final_value: totalValorMinimo > 0 ? totalValorMinimo : (o.final_value ?? null),
                      vigencia: rp.vigencia || "",
                      taxa_instalacao: rp.taxaInstalacao ? Number(rp.taxaInstalacao) : null,
                      bloco_ip: rp.blocoIp || "",
                      tipo_solicitacao: "Nova Ativação",
                      valor_a_ser_vendido: null,
                      codigo_smark: "",
                      observacoes_user: [o.notes, obsSystem].filter(Boolean).join("\n\n"),
                      observacoes_system: "",
                      created_at: new Date().toISOString(),
                      produto: rp.produto || "NT LINK DEDICADO FULL",
                      tecnologia: rp.tecnologia || "GPON",
                      tecnologia_meio_fisico: "Fibra",
                      coordenadas: `${geoResult.lat}, ${geoResult.lng}`,
                    };
                    addItems([newItem]);
                    setSelectedOptionIdx(null);
                    toast({ title: "Item adicionado ao carrinho" });
                  }}>
                    <ShoppingCart className="h-4 w-4" /> Adicionar ao Carrinho
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-2" onClick={exportToExcel}>
                  <Download className="h-4 w-4" /> Excel
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="overflow-x-auto border rounded-md">
              <table className="text-xs w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-center w-8"></th>
                    <th className="px-2 py-1.5 text-left">#</th>
                    <th className="px-2 py-1.5 text-left">Etapa</th>
                    <th className="px-2 py-1.5 text-left">Provedor</th>
                    <th className="px-2 py-1.5 text-right">Distância</th>
                    <th className="px-2 py-1.5 text-left min-w-[130px]">Produto Link IP</th>
                    <th className="px-2 py-1.5 text-left min-w-[80px]">Vigência</th>
                    <th className="px-2 py-1.5 text-left min-w-[90px]">Taxa Instal.</th>
                    <th className="px-2 py-1.5 text-left min-w-[80px]">Tecnologia</th>
                    <th className="px-2 py-1.5 text-left min-w-[130px]">Cidade Ponta A</th>
                    {/* Dynamic columns header - render union of all row products */}
                    {(() => {
                      // Check all rows to see which dynamic columns to show
                      const hasDarkFiber = options.some((_, i) => getRowPricing(i).produto === "NT DARK FIBER");
                      const hasL2L = options.some((_, i) => getRowPricing(i).produto === "NT L2L");
                      const hasNonDarkFiber = options.some((_, i) => getRowPricing(i).produto !== "NT DARK FIBER");
                      const hasNonL2LNonDF = options.some((_, i) => {
                        const p = getRowPricing(i).produto;
                        return p !== "NT L2L" && p !== "NT DARK FIBER";
                      });
                      return (
                        <>
                          {hasNonDarkFiber && <th className="px-2 py-1.5 text-left min-w-[80px]">Velocidade</th>}
                          {hasNonL2LNonDF && <th className="px-2 py-1.5 text-left min-w-[110px]">Bloco IP</th>}
                          {hasDarkFiber && <th className="px-2 py-1.5 text-left min-w-[80px]">Qtd Fibras</th>}
                          {hasL2L && <th className="px-2 py-1.5 text-left min-w-[130px]">Cidade Ponta B</th>}
                        </>
                      );
                    })()}
                    <th className="px-2 py-1.5 text-right min-w-[130px]">Valor Mínimo Previsto</th>
                    <th className="px-2 py-1.5 text-left">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {options.map((o, i) => {
                    const rp = getRowPricing(i);
                    const valorMin = rowValorMinimo[i];
                    const isCalc = rowCalcLoading[i];
                    const isDarkFiber = rp.produto === "NT DARK FIBER";
                    const isL2L = rp.produto === "NT L2L";

                    // Check union flags for dynamic columns
                    const hasDarkFiber = options.some((_, j) => getRowPricing(j).produto === "NT DARK FIBER");
                    const hasL2L = options.some((_, j) => getRowPricing(j).produto === "NT L2L");
                    const hasNonDarkFiber = options.some((_, j) => getRowPricing(j).produto !== "NT DARK FIBER");
                    const hasNonL2LNonDF = options.some((_, j) => {
                      const p = getRowPricing(j).produto;
                      return p !== "NT L2L" && p !== "NT DARK FIBER";
                    });

                    return (
                    <tr
                      key={i}
                      className={`border-t ${selectedOptionIdx === i ? "bg-primary/10" : ""} ${o.is_check_om ? "bg-yellow-50 dark:bg-yellow-900/10" : o.is_blocked ? "bg-destructive/5" : ""}`}
                    >
                      <td className="px-2 py-1 text-center">
                        <input
                          type="radio"
                          name="viability-option"
                          checked={selectedOptionIdx === i}
                          onClick={() => setSelectedOptionIdx(selectedOptionIdx === i ? null : i)}
                          readOnly
                          className="h-3.5 w-3.5 accent-primary cursor-pointer"
                        />
                      </td>
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

                      {/* Produto */}
                      <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                        <Select value={rp.produto} onValueChange={v => setRowField(i, "produto", v)}>
                          <SelectTrigger className="h-6 text-[10px] border-dashed w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUTO_LINK_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Vigência */}
                      <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                        <Select value={rp.vigencia} onValueChange={v => setRowField(i, "vigencia", v)}>
                          <SelectTrigger className="h-6 text-[10px] border-dashed w-[70px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VIGENCIA_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Taxa Instalação */}
                      <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                        <Input
                          type="number"
                          min="0"
                          className="h-6 text-[10px] w-[80px] border-dashed"
                          value={rp.taxaInstalacao}
                          onChange={e => { const v = e.target.value; if (v === "" || Number(v) >= 0) setRowField(i, "taxaInstalacao", v); }}
                        />
                      </td>

                      {/* Tecnologia */}
                      <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                        <Select value={rp.tecnologia} onValueChange={v => setRowField(i, "tecnologia", v)}>
                          <SelectTrigger className="h-6 text-[10px] border-dashed w-[70px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TECNOLOGIA_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Cidade Ponta A */}
                      <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                        <Select value={rp.cidadePontaA} onValueChange={v => setRowField(i, "cidadePontaA", v)}>
                          <SelectTrigger className="h-6 text-[10px] border-dashed w-[120px]">
                            <SelectValue placeholder="Cidade..." />
                          </SelectTrigger>
                          <SelectContent>
                            {formOptions.redes.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Dynamic: Velocidade (hidden for Dark Fiber) */}
                      {hasNonDarkFiber && (
                        <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                          {isDarkFiber ? (
                            <span className="text-[10px] text-muted-foreground px-1">—</span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              className="h-6 text-[10px] w-[70px] border-dashed"
                              value={rp.velocidade}
                              placeholder={velocidade || "MB"}
                              onChange={e => { const v = e.target.value; if (v === "" || Number(v) >= 0) setRowField(i, "velocidade", v); }}
                            />
                          )}
                        </td>
                      )}

                      {/* Dynamic: Bloco IP (hidden for L2L and Dark Fiber) */}
                      {hasNonL2LNonDF && (
                        <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                          {(isL2L || isDarkFiber) ? (
                            <span className="text-[10px] text-muted-foreground px-1">—</span>
                          ) : (
                            <Select value={rp.blocoIp} onValueChange={v => setRowField(i, "blocoIp", v)}>
                              <SelectTrigger className="h-6 text-[10px] border-dashed w-[100px]">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                {BLOCO_IP_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      )}

                      {/* Dynamic: Qtd Fibras (only for Dark Fiber rows) */}
                      {hasDarkFiber && (
                        <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                          {isDarkFiber ? (
                            <Input
                              type="number"
                              min="0"
                              className="h-6 text-[10px] w-[70px] border-dashed"
                              value={rp.qtdFibrasDarkFiber}
                              placeholder="Qtd"
                              onChange={e => { const v = e.target.value; if (v === "" || Number(v) >= 0) setRowField(i, "qtdFibrasDarkFiber", v); }}
                            />
                          ) : (
                            <span className="text-[10px] text-muted-foreground px-1">—</span>
                          )}
                        </td>
                      )}

                      {/* Dynamic: Cidade Ponta B (only for L2L rows) */}
                      {hasL2L && (
                        <td className="px-1 py-1" onClick={e => e.stopPropagation()}>
                          {isL2L ? (
                            <Select value={rp.cidadePontaB} onValueChange={v => setRowField(i, "cidadePontaB", v)}>
                              <SelectTrigger className="h-6 text-[10px] border-dashed w-[120px]">
                                <SelectValue placeholder="Cidade B..." />
                              </SelectTrigger>
                              <SelectContent>
                                {formOptions.redes.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-[10px] text-muted-foreground px-1">—</span>
                          )}
                        </td>
                      )}

                      {/* Valor Mínimo Previsto */}
                      <td className="px-2 py-1 text-right font-semibold text-primary">
                        {isCalc ? (
                          <Loader2 className="h-3 w-3 animate-spin inline-block" />
                        ) : (() => {
                          const lpu = o.final_value ?? 0;
                          const calc = valorMin ?? 0;
                          const total = lpu + calc;
                          return total > 0
                            ? `R$${total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—";
                        })()}
                      </td>
                      <td className="px-2 py-1 max-w-[200px] truncate text-muted-foreground">{o.notes}</td>
                    </tr>
                    );
                  })}
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
            <div className="overflow-x-auto border rounded-md">
              <table className="text-xs w-full">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Parceiro</th>
                    <th className="px-2 py-1.5 text-left">Distância</th>
                    <th className="px-2 py-1.5 text-left">Contato / Telefone</th>
                  </tr>
                </thead>
                <tbody>
                  {radiusResults.slice(0, 5).map((r, i) => {
                    const d = r.distanceM;
                    const distLabel = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d.toFixed(0)} m`;
                    // Match parceiro to provider or pre_provider by partial name (contains)
                    const parcNorm = r.compra.parceiro?.trim().toLowerCase() || "";
                    const matchedProvider = (providers || []).find(p => {
                      const pn = p.name.trim().toLowerCase();
                      return parcNorm.includes(pn) || pn.includes(parcNorm);
                    });
                    const matchedPreProvider = !matchedProvider ? (preProviders || []).find(pp => {
                      const ppn = pp.nome_fantasia.trim().toLowerCase();
                      return parcNorm.includes(ppn) || ppn.includes(parcNorm);
                    }) : null;
                    const contactName = matchedProvider?.gerente_comercial || matchedProvider?.contato_noc_nome || matchedPreProvider?.contato_comercial_nome || matchedPreProvider?.contato_noc_nome || "";
                    const contactPhone = matchedProvider?.telefone_gerente || matchedProvider?.contato_noc_fone || matchedPreProvider?.contato_comercial_fone || matchedPreProvider?.contato_noc_fone || "";
                    const contactLabel = [contactName, contactPhone].filter(Boolean).join(" · ") || "—";
                    return (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{r.compra.parceiro}</td>
                        <td className="px-2 py-1 font-mono">{distLabel}</td>
                        <td className="px-2 py-1 text-muted-foreground">{contactLabel}</td>
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
