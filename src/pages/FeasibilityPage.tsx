import { useState, useEffect, useRef, useCallback } from "react";
import { useProviders } from "@/hooks/useProviders";
import { useGeoElements } from "@/hooks/useGeoElements";
import { useLpuItems } from "@/hooks/useLpuItems";
import { useCreateFeasibility } from "@/hooks/useFeasibility";
import { useAuth } from "@/contexts/AuthContext";
import {
  geocodeAddress,
  findNearestPoint,
  findBestTA,
  findBestConnectionPoint,
  findBestConnectionPointByRoute,
  findNearestConnectionPointAny,
  getRouteDistance,
  isInsideCoverage,
  findNearestBoundaryPoint,
  haversineDistance,
  closedLineToPolygon,
  routeCrossesCPFL,
  checkRouteHighwayRailwayWithCache,
  prefetchHighwaysForArea,
  extractNttCables,
  evaluateConnectionAptness,
  type TAResult,
  type ProviderRules,
} from "@/lib/geo-utils";
import { fetchCep } from "@/lib/cep-utils";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, Share2, CheckCircle, XCircle, Loader2, Ban, Navigation, Hash, Wifi, Building2, AlertTriangle } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2canvas from "html2canvas";

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type ResultStatus = "inside" | "outside_viable" | "outside_not_viable" | "too_far" | "check_om";

interface FeasibilityResult {
  address: string;
  lat: number;
  lng: number;
  providerName: string;
  providerColor: string;
  distance: number;
  maxDistance: number;
  lpuValue: number;
  lpuType: string;
  multiplier: number;
  finalValue: number;
  status: ResultStatus;
  providerId: string;
  routeGeometry?: any;
  nearestPoint?: [number, number];
  isOwnNetwork?: boolean;
  hasCrossNtt?: boolean;
  taResult?: TAResult;
  cpflBlocked?: boolean;
  cpflMessage?: string;
  highwayBlocked?: boolean;
  highwayMessage?: string;
  providerRules?: ProviderRules;
  checkOmBoxName?: string;
  snapPoint?: [number, number]; // lat/lng of the snapped road point (off-road origin)
}

export default function FeasibilityPage() {
  const { data: providers, refetch: refetchProviders } = useProviders();
  const { data: allGeoElements } = useGeoElements();
  const { data: allLpuItems } = useLpuItems();
  const createFeasibility = useCreateFeasibility();
  const { user } = useAuth();
  const { toast } = useToast();

  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [selectedLpuType, setSelectedLpuType] = useState("");
  const [customMultiplier, setCustomMultiplier] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FeasibilityResult[]>([]);
  const [resolvedGeo, setResolvedGeo] = useState<{ lat: number; lng: number; display: string } | null>(null);
  const [coordLat, setCoordLat] = useState("");
  const [coordLng, setCoordLng] = useState("");
  const [cep, setCep] = useState("");
  const [cepAddress, setCepAddress] = useState("");
  const [cepNumber, setCepNumber] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [inputMode, setInputMode] = useState<"address" | "coords" | "cep">("address");
  const [mapZoom, setMapZoom] = useState(() => {
    const saved = localStorage.getItem("feasibility_map_zoom");
    return saved ? parseInt(saved, 10) : 15;
  });
  const handleZoomChange = (value: number) => {
    setMapZoom(value);
    localStorage.setItem("feasibility_map_zoom", String(value));
  };
  const [cepGeo, setCepGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [cepData, setCepData] = useState<{ logradouro: string; bairro: string; localidade: string; uf: string } | null>(null);

  const handleCepLookup = async (value: string) => {
    setCep(value);
    setCepGeo(null);
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

  /** Geocode CEP using structured Nominatim search with multiple fallbacks */
  const geocodeCepAddress = async (number?: string): Promise<{ lat: number; lng: number; display: string } | null> => {
    if (!cepData) return null;
    const street = number ? `${cepData.logradouro}, ${number}` : cepData.logradouro;

    const params1 = new URLSearchParams({
      format: "json", street, city: cepData.localidade, state: cepData.uf, country: "BR", limit: "1",
    });
    let res = await fetch(`https://nominatim.openstreetmap.org/search?${params1}`);
    let results = await res.json();

    if (results.length === 0) {
      const clean = cep.replace(/\D/g, "");
      const params2 = new URLSearchParams({ format: "json", postalcode: clean, country: "BR", limit: "1" });
      res = await fetch(`https://nominatim.openstreetmap.org/search?${params2}`);
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

  const handleCalculate = async () => {
    setLoading(true);
    setResults([]);

    try {
      let geo: { lat: number; lng: number; display: string } | null = null;

      if (inputMode === "address") {
        if (resolvedGeo && !addressNumber) {
          geo = resolvedGeo;
        } else if (resolvedGeo && addressNumber) {
          // Re-geocode with number for precise placement
          const fullAddr = address.includes(addressNumber) ? address : `${address}, ${addressNumber}`;
          geo = await geocodeAddress(fullAddr);
          if (!geo) geo = resolvedGeo; // fallback to autocomplete result
        } else if (address.trim()) {
          const fullAddr = addressNumber ? `${address}, ${addressNumber}` : address;
          geo = await geocodeAddress(fullAddr);
        }
        if (!geo) {
          toast({ title: "Endereço não encontrado", variant: "destructive" });
          setLoading(false);
          return;
        }
      } else if (inputMode === "coords") {
        const lat = parseFloat(coordLat);
        const lng = parseFloat(coordLng);
        if (isNaN(lat) || isNaN(lng)) {
          toast({ title: "Coordenadas inválidas", variant: "destructive" });
          setLoading(false);
          return;
        }
        geo = { lat, lng, display: `${lat}, ${lng}` };
      } else if (inputMode === "cep") {
        if (!cepAddress || !cepData) {
          toast({ title: "Busque um CEP válido primeiro", variant: "destructive" });
          setLoading(false);
          return;
        }
        geo = await geocodeCepAddress(cepNumber || undefined);
        if (!geo) {
          toast({ title: "Endereço do CEP não encontrado", variant: "destructive" });
          setLoading(false);
          return;
        }
      }

      if (!geo) {
        toast({ title: "Informe um endereço, coordenadas ou CEP", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Always reload providers before running rules to avoid stale toggles (e.g. considerar_ce)
      const { data: latestProviders } = await refetchProviders();
      const providersToUse = latestProviders ?? providers ?? [];

      if (!providersToUse.length || !allGeoElements?.length) {
        toast({ title: "Cadastre provedores e importe dados antes", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Pre-group elements by provider for O(1) lookup instead of repeated filter
      const elementsByProvider: Record<string, typeof allGeoElements> = {};
      for (const el of allGeoElements) {
        if (!elementsByProvider[el.provider_id]) elementsByProvider[el.provider_id] = [];
        elementsByProvider[el.provider_id].push(el);
      }

      // Identify Net Turbo (own network)
      const netTurboProvider = providersToUse.find(p => p.name.toLowerCase().includes("net turbo"));

      // Process all providers in PARALLEL for speed
      const dbSaves: Array<Parameters<typeof createFeasibility.mutateAsync>[0]> = [];

      const processProvider = async (provider: typeof providersToUse[0]): Promise<{ result: FeasibilityResult; save: Parameters<typeof createFeasibility.mutateAsync>[0] } | null> => {
        const providerElements = elementsByProvider[provider.id] || [];
        if (!providerElements.length) return null;

        const isNetTurbo = provider.id === netTurboProvider?.id;
        const inside = isInsideCoverage(geo.lat, geo.lng, providerElements);

        const providerLpu = allLpuItems?.filter((l) => l.provider_id === provider.id) || [];
        let lpuItem = providerLpu.find((l) => l.link_type === selectedLpuType);
        if (!lpuItem && providerLpu.length > 0) lpuItem = providerLpu[0];
        const lpuValue = lpuItem?.value || 0;
        const mult = customMultiplier ? parseFloat(customMultiplier) : provider.multiplier;
        const finalValue = mult > 0 ? lpuValue / mult : lpuValue;
        const maxDist = provider.max_lpu_distance_m;

        const providerRules: ProviderRules = {
          regras_usar_porta_disponivel: (provider as any).regras_usar_porta_disponivel ?? true,
          regras_considerar_ta: (provider as any).regras_considerar_ta ?? true,
          regras_considerar_ce: (provider as any).regras_considerar_ce ?? false,
          regras_bloquear_splitter_1x2: (provider as any).regras_bloquear_splitter_1x2 ?? true,
          regras_bloquear_splitter_des: (provider as any).regras_bloquear_splitter_des ?? true,
          regras_bloquear_portas_livres_zero: (provider as any).regras_bloquear_portas_livres_zero ?? true,
          regras_bloquear_atendimento_nao_sim: (provider as any).regras_bloquear_atendimento_nao_sim ?? true,
          regras_habilitar_exclusao_cpfl: (provider as any).regras_habilitar_exclusao_cpfl ?? true,
          regras_bloquear_cruzamento_rodovia: (provider as any).regras_bloquear_cruzamento_rodovia ?? true,
        };

        if (isNetTurbo) {
          const insideNT = inside;
          let distance = 0;
          let routeGeometry: any = null;
          let nearestPt: [number, number] | undefined = undefined;
          let isViableNT = false;
          let taResult: TAResult | undefined = undefined;
          let cpflBlocked = false;
          let cpflMessage: string | undefined = undefined;
          let highwayBlocked = false;
          let highwayMessage: string | undefined = undefined;
          let snapPoint: [number, number] | undefined = undefined;

          const elMapped = providerElements.map((e) => ({ geometry: e.geometry, provider_id: e.provider_id, properties: e.properties }));

          // Pre-fetch highways/railways ONCE for the customer area
          const [overpassResult, nttCables] = await Promise.all([
            prefetchHighwaysForArea(geo.lat, geo.lng, maxDist + 1000),
            Promise.resolve(extractNttCables(elMapped)),
          ]);
          const cachedWays = overpassResult.ways;
          const overpassFailed = !overpassResult.success;

          if (insideNT) {
            const cp = findBestConnectionPoint(geo.lat, geo.lng, elMapped, maxDist, providerRules);
            if (cp) { taResult = cp; nearestPt = cp.point; }
            distance = 0;
            isViableNT = true;
          } else {
            let lastBlocked: { type: "cpfl" | "highway"; message?: string } | null = null;

            const cpByRoute = await findBestConnectionPointByRoute(
              geo.lat,
              geo.lng,
              elMapped,
              maxDist,
              providerRules,
              Number.POSITIVE_INFINITY,
              async (_candidate, route) => {
                if (providerRules.regras_habilitar_exclusao_cpfl && route.geometry) {
                  const cpflCheck = routeCrossesCPFL(route.geometry, elMapped);
                  if (cpflCheck.crosses) {
                    lastBlocked = { type: "cpfl", message: cpflCheck.message };
                    return false;
                  }
                }

                if (providerRules.regras_bloquear_cruzamento_rodovia && route.geometry) {
                  const hwCheck = checkRouteHighwayRailwayWithCache(route.geometry, cachedWays, nttCables, overpassFailed);
                  if (hwCheck.blocked) {
                    lastBlocked = { type: "highway", message: hwCheck.message };
                    return false;
                  }
                }

                return true;
              }
            );

            if (cpByRoute) {
              taResult = cpByRoute.taResult;
              nearestPt = cpByRoute.taResult.point;
              distance = cpByRoute.routeDistance;
              routeGeometry = cpByRoute.routeGeometry;
              snapPoint = (cpByRoute as any).snapPoint;
              isViableNT = distance <= maxDist;
            } else if (lastBlocked) {
              isViableNT = false;
              if (lastBlocked.type === "cpfl") {
                cpflBlocked = true;
                cpflMessage = lastBlocked.message;
              } else {
                highwayBlocked = true;
                highwayMessage = lastBlocked.message;
              }
            } else {
              const nearest = findNearestPoint(geo.lat, geo.lng, elMapped);
              if (!nearest) {
                // Check for nearby unavailable box before giving up
                const nearestAnyBox = findNearestConnectionPointAny(geo.lat, geo.lng, elMapped, maxDist);
                if (nearestAnyBox) {
                  const result: FeasibilityResult = {
                    address: geo.display, lat: geo.lat, lng: geo.lng,
                    providerName: provider.name, providerColor: provider.color,
                    distance: Math.round(nearestAnyBox.distance), maxDistance: maxDist,
                    lpuValue: 0, lpuType: "Rede Própria", multiplier: 1, finalValue: 0,
                    status: "check_om", providerId: provider.id,
                    nearestPoint: nearestAnyBox.point, isOwnNetwork: true,
                    checkOmBoxName: `${nearestAnyBox.tipo}: ${nearestAnyBox.nome}`,
                  };
                  const save = {
                    user_id: user?.id, customer_address: address || geo.display,
                    customer_lat: geo.lat, customer_lng: geo.lng, provider_id: provider.id,
                    calculated_distance_m: Math.round(nearestAnyBox.distance), lpu_value: 0, multiplier: 1, final_value: 0,
                    is_viable: false,
                    notes: `Caixa próxima ao cliente, porém indisponível. Checar com O&M a disponibilidade da mesma. ${nearestAnyBox.tipo}: ${nearestAnyBox.nome}`,
                  };
                  return { result, save };
                }
                return null;
              }
              nearestPt = nearest.point;
              try {
                const route = await getRouteDistance(geo.lat, geo.lng, nearest.point[0], nearest.point[1]);
                if (route?.geometry) { distance = route.distance; routeGeometry = route.geometry; snapPoint = route.snapPoint; }
                else return null;
              } catch { return null; }
              // Also check highway/railway for fallback route using cached data
              if (providerRules.regras_bloquear_cruzamento_rodovia && routeGeometry) {
                const hwCheck = checkRouteHighwayRailwayWithCache(routeGeometry, cachedWays, nttCables, overpassFailed);
                if (hwCheck.blocked) { highwayBlocked = true; highwayMessage = hwCheck.message; }
              }
              if (!highwayBlocked && distance > maxDist) {
                // Distance exceeds limit — check for nearby unavailable box
                const nearestAnyBox = findNearestConnectionPointAny(geo.lat, geo.lng, elMapped, maxDist);
                if (nearestAnyBox) {
                  const result: FeasibilityResult = {
                    address: geo.display, lat: geo.lat, lng: geo.lng,
                    providerName: provider.name, providerColor: provider.color,
                    distance: Math.round(nearestAnyBox.distance), maxDistance: maxDist,
                    lpuValue: 0, lpuType: "Rede Própria", multiplier: 1, finalValue: 0,
                    status: "check_om", providerId: provider.id,
                    nearestPoint: nearestAnyBox.point, isOwnNetwork: true,
                    checkOmBoxName: `${nearestAnyBox.tipo}: ${nearestAnyBox.nome}`,
                  };
                  const save = {
                    user_id: user?.id, customer_address: address || geo.display,
                    customer_lat: geo.lat, customer_lng: geo.lng, provider_id: provider.id,
                    calculated_distance_m: Math.round(nearestAnyBox.distance), lpu_value: 0, multiplier: 1, final_value: 0,
                    is_viable: false,
                    notes: `Caixa próxima ao cliente, porém indisponível. Checar com O&M a disponibilidade da mesma. ${nearestAnyBox.tipo}: ${nearestAnyBox.nome}`,
                  };
                  return { result, save };
                }
              }
              isViableNT = !highwayBlocked && distance <= maxDist;
            }
          }

          const taNote = taResult ? `${taResult.tipo}: ${taResult.nome} | ${taResult.aptoNovoCliente ? "Apto" : "Não apto"} | ${taResult.motivoBloqueio || taResult.motivo}` : "";

          const isBlocked = cpflBlocked || highwayBlocked;
          const blockMessage = cpflBlocked ? cpflMessage : highwayBlocked ? highwayMessage : undefined;

          const result: FeasibilityResult = {
            address: geo.display, lat: geo.lat, lng: geo.lng,
            providerName: provider.name, providerColor: provider.color,
            distance: Math.round(distance), maxDistance: maxDist,
            lpuValue: 0, lpuType: "Rede Própria", multiplier: 1, finalValue: 0,
            status: isBlocked ? "outside_not_viable" : insideNT ? "inside" : isViableNT ? "outside_viable" : "outside_not_viable",
            providerId: provider.id, routeGeometry: !insideNT ? routeGeometry : undefined,
            nearestPoint: nearestPt, isOwnNetwork: true, taResult, cpflBlocked, cpflMessage,
            highwayBlocked, highwayMessage, providerRules, snapPoint: !insideNT ? snapPoint : undefined,
          };
          const save = {
            user_id: user?.id, customer_address: address || geo.display,
            customer_lat: geo.lat, customer_lng: geo.lng, provider_id: provider.id,
            calculated_distance_m: Math.round(distance), lpu_value: 0, multiplier: 1, final_value: 0,
            is_viable: isBlocked ? false : isViableNT,
            notes: isBlocked ? blockMessage : insideNT ? `Rede própria - Dentro da cobertura. ${taNote}` : isViableNT ? `Rede própria - Viável. ${taNote}` : `Rede própria - Não atende. ${taNote}`,
          };
          return { result, save };

        } else if (inside) {
          const result: FeasibilityResult = {
            address: geo.display, lat: geo.lat, lng: geo.lng,
            providerName: provider.name, providerColor: provider.color,
            distance: 0, maxDistance: maxDist, lpuValue, lpuType: lpuItem?.link_type || "N/A",
            multiplier: mult, finalValue: Math.round(finalValue * 100) / 100,
            status: "inside", providerId: provider.id, hasCrossNtt: provider.has_cross_ntt,
          };
          const save = {
            user_id: user?.id, customer_address: address || geo.display,
            customer_lat: geo.lat, customer_lng: geo.lng, provider_id: provider.id,
            calculated_distance_m: 0, lpu_value: lpuValue, multiplier: mult,
            final_value: finalValue, is_viable: true,
          };
          return { result, save };

        } else {
          const nearest = findNearestBoundaryPoint(geo.lat, geo.lng, providerElements);
          if (!nearest) return null;
          const nearestAny = findNearestPoint(geo.lat, geo.lng, providerElements.map((e) => ({ geometry: e.geometry, provider_id: e.provider_id, properties: e.properties })));
          const bestNearest = nearestAny && nearestAny.distance < nearest.distance ? nearestAny : nearest;
          let distance = bestNearest.distance;
          let routeGeometry: any = null;
          let snapPoint: [number, number] | undefined = undefined;
          try {
            const route = await getRouteDistance(geo.lat, geo.lng, bestNearest.point[0], bestNearest.point[1]);
            if (route) { distance = route.distance; routeGeometry = route.geometry; snapPoint = route.snapPoint; }
          } catch {}

          const tooFar = distance > maxDist * 2;
          const isViable = distance <= maxDist;
          const status: ResultStatus = tooFar ? "too_far" : isViable ? "outside_viable" : "outside_not_viable";
          if (status === "too_far" || status === "outside_not_viable") return null;

          const result: FeasibilityResult = {
            address: geo.display, lat: geo.lat, lng: geo.lng,
            providerName: provider.name, providerColor: provider.color,
            distance: Math.round(distance), maxDistance: maxDist, lpuValue,
            lpuType: lpuItem?.link_type || "N/A", multiplier: mult,
            finalValue: Math.round(finalValue * 100) / 100, status, providerId: provider.id,
            routeGeometry, nearestPoint: bestNearest.point, hasCrossNtt: provider.has_cross_ntt,
            snapPoint,
          };
          const save = {
            user_id: user?.id, customer_address: address || geo.display,
            customer_lat: geo.lat, customer_lng: geo.lng, provider_id: provider.id,
            calculated_distance_m: Math.round(distance), lpu_value: lpuValue,
            multiplier: mult, final_value: finalValue, is_viable: isViable,
          };
          return { result, save };
        }
      };

      // Run all providers in parallel
      const allResults = await Promise.all(providersToUse.map(p => processProvider(p)));
      const validResults = allResults.filter((r): r is NonNullable<typeof r> => r !== null);

      const newResults = validResults.map(r => r.result);

      // Batch save all feasibility records (fire-and-forget, don't block UI)
      Promise.all(validResults.map(r => createFeasibility.mutateAsync(r.save))).catch(() => {});

      // Sort: Net Turbo first, then inside, then cross NTT viable, then others viable
      setResults(newResults.sort((a, b) => {
        if (a.isOwnNetwork && !b.isOwnNetwork) return -1;
        if (!a.isOwnNetwork && b.isOwnNetwork) return 1;
        const statusOrder: Record<ResultStatus, number> = { inside: 0, outside_viable: 1, check_om: 2, outside_not_viable: 3, too_far: 4 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        if (a.hasCrossNtt && !b.hasCrossNtt) return -1;
        if (!a.hasCrossNtt && b.hasCrossNtt) return 1;
        return a.distance - b.distance;
      }));

      if (newResults.length === 0) {
        toast({ title: "Nenhum provedor viável encontrado para este endereço" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const shareResult = (r: FeasibilityResult, via: "whatsapp" | "email") => {
    const statusText = r.isOwnNetwork ? "🔵 REDE PRÓPRIA" : r.status === "inside" ? "✅ DENTRO DA COBERTURA" : r.status === "outside_viable" ? "✅ VIÁVEL" : r.status === "outside_not_viable" ? "⚠️ FORA DO LPU" : "❌ SEM COBERTURA";
    const distanceLine = r.status === "inside" && !r.isOwnNetwork ? "" : `\nDistância: ${r.distance}m`;
    const valueLine = r.isOwnNetwork ? "" : `\nTipo: ${r.lpuType}\nValor Mínimo: R$ ${r.finalValue.toFixed(2)}`;
    const text = `📍 Viabilidade de Fibra\n\nEndereço: ${r.address}\n${r.isOwnNetwork ? "Rede" : "Provedor"}: ${r.providerName}\nStatus: ${statusText}${distanceLine}${valueLine}`;

    if (via === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } else {
      window.open(`mailto:?subject=Viabilidade de Fibra - ${r.providerName}&body=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const lpuTypes = [...new Set(allLpuItems?.map((l) => l.link_type) || [])];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Calculadora de Viabilidade</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Localização do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="address" className="flex-1 gap-1">
                <MapPin className="h-3.5 w-3.5" /> Endereço
              </TabsTrigger>
              <TabsTrigger value="coords" className="flex-1 gap-1">
                <Navigation className="h-3.5 w-3.5" /> Coordenadas
              </TabsTrigger>
              <TabsTrigger value="cep" className="flex-1 gap-1">
                <Hash className="h-3.5 w-3.5" /> CEP
              </TabsTrigger>
            </TabsList>

            <TabsContent value="address" className="mt-3 space-y-2">
              <div>
                <Label>Endereço</Label>
                <AddressAutocomplete
                  value={address}
                  onChange={(val) => {
                    setAddress(val);
                    setResolvedGeo(null);
                  }}
                  onSelect={(result) => {
                    setAddress(result.address);
                    setResolvedGeo({ lat: result.lat, lng: result.lng, display: result.address });
                  }}
                  placeholder="Ex: Rua Sergio Potulski, Sumaré - SP"
                />
              </div>
              <div className="w-32">
                <Label>Número</Label>
                <Input placeholder="243" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} />
              </div>
            </TabsContent>

            <TabsContent value="coords" className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Latitude</Label>
                  <Input type="number" step="any" placeholder="-22.8231" value={coordLat} onChange={(e) => setCoordLat(e.target.value)} />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input type="number" step="any" placeholder="-47.2668" value={coordLng} onChange={(e) => setCoordLng(e.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="cep" className="mt-3 space-y-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input placeholder="13170-000" value={cep} onChange={(e) => handleCepLookup(e.target.value)} maxLength={9} />
                    {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input value={cepAddress} readOnly placeholder="Preencha o CEP" className="bg-muted" />
                </div>
              </div>
              <div className="w-32">
                <Label>Número</Label>
                <Input placeholder="275" value={cepNumber} onChange={(e) => setCepNumber(e.target.value)} />
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Link (LPU)</Label>
              <Select value={selectedLpuType} onValueChange={setSelectedLpuType}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos / Primeiro disponível" />
                </SelectTrigger>
                <SelectContent>
                  {lpuTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Multiplicador customizado (opcional)</Label>
              <Input type="number" step="0.01" placeholder="Usar padrão do provedor" value={customMultiplier} onChange={(e) => setCustomMultiplier(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleCalculate} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "Calculando..." : "Calcular Viabilidade"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Resultados ({results.length} {results.length === 1 ? "opção" : "opções"})</h2>
            <div className="flex items-center gap-3 bg-muted px-3 py-1.5 rounded-lg">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Zoom do mapa:</span>
              <input
                type="range" min={10} max={50} value={mapZoom}
                onChange={(e) => handleZoomChange(parseInt(e.target.value, 10))}
                className="w-24 h-1.5 accent-primary"
              />
              <span className="text-sm font-mono font-bold w-6 text-center">{mapZoom}</span>
            </div>
          </div>
          {results.map((r) => (
            <ResultCard key={`${r.providerId}-${r.address}-${r.lat}-${r.lng}`} result={r} allGeoElements={allGeoElements || []} onShare={shareResult} mapZoom={mapZoom} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Individual result card with mini-map */
function ResultCard({
  result: r,
  allGeoElements,
  onShare,
  mapZoom,
}: {
  result: FeasibilityResult;
  allGeoElements: any[];
  onShare: (r: FeasibilityResult, via: "whatsapp" | "email") => void;
  mapZoom: number;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  const captureCardImage = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true, allowTaint: true, backgroundColor: "#ffffff", scale: 2,
      });
      return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
    } catch {
      return null;
    }
  };

  const shareWithImage = async (via: "whatsapp" | "email") => {
    setCapturing(true);
    try {
      const blob = await captureCardImage();
      if (blob && navigator.share) {
        const file = new File([blob], `viabilidade-${r.providerName}.png`, { type: "image/png" });
        const statusText = r.isOwnNetwork ? "🔵 REDE PRÓPRIA" : r.status === "inside" ? "✅ DENTRO DA COBERTURA" : r.status === "outside_viable" ? "✅ VIÁVEL" : "⚠️ FORA DO LPU";
        const distanceLine = r.status === "inside" && !r.isOwnNetwork ? "" : `\nDistância: ${r.distance}m`;
        const valueLine = r.isOwnNetwork ? "" : `\nTipo: ${r.lpuType}\nValor Mínimo: R$ ${r.finalValue.toFixed(2)}`;
        const text = `📍 Viabilidade de Fibra\n\nEndereço: ${r.address}\n${r.isOwnNetwork ? "Rede" : "Provedor"}: ${r.providerName}\nStatus: ${statusText}${distanceLine}${valueLine}`;
        await navigator.share({ title: `Viabilidade - ${r.providerName}`, text, files: [file] });
      } else {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `viabilidade-${r.providerName}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
        onShare(r, via);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") onShare(r, via);
    } finally {
      setCapturing(false);
    }
  };

  const showMap = true; // Always show map for viable results

  useEffect(() => {
    if (!showMap || !mapContainerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const container = mapContainerRef.current as HTMLDivElement & { _leaflet_id?: number };
    if (container._leaflet_id) {
      container._leaflet_id = undefined;
    }

    const map = L.map(container, {
      zoomControl: false, attributionControl: false, maxZoom: 50,
    }).setView([r.lat, r.lng], mapZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxNativeZoom: 19, maxZoom: 50,
    }).addTo(map);
    mapRef.current = map;

    L.marker([r.lat, r.lng]).addTo(map).bindPopup(`<b>Cliente</b><br/>${r.address}`);

    const providerElements = allGeoElements.filter((e) => e.provider_id === r.providerId);
    const bounds = L.latLngBounds([[r.lat, r.lng]]);

    const maxRenderDist = 20000;
    const nearbyElements = providerElements.filter((el) => {
      const rawGeo = typeof el.geometry === "string" ? JSON.parse(el.geometry) : el.geometry;
      if (!rawGeo?.coordinates) return false;
      let sampleCoord: number[] | null = null;
      if (rawGeo.type === "Point") sampleCoord = rawGeo.coordinates;
      else if (rawGeo.type === "Polygon") sampleCoord = rawGeo.coordinates?.[0]?.[0];
      else if (rawGeo.type === "MultiPolygon") sampleCoord = rawGeo.coordinates?.[0]?.[0]?.[0];
      else if (rawGeo.type === "LineString") sampleCoord = rawGeo.coordinates?.[0];
      else if (rawGeo.type === "MultiLineString") sampleCoord = rawGeo.coordinates?.[0]?.[0];
      if (!sampleCoord) return false;
      const dist = haversineDistance(r.lat, r.lng, sampleCoord[1], sampleCoord[0]);
      return dist <= maxRenderDist;
    });

    for (const el of nearbyElements) {
      try {
        const rawGeo = typeof el.geometry === "string" ? JSON.parse(el.geometry) : el.geometry;
        const geo = closedLineToPolygon(rawGeo);
        const props = (typeof el.properties === "string" ? JSON.parse(el.properties) : el.properties) || {};
        const isConvertedPolygon = geo.type !== rawGeo?.type;

        if (geo.type === "Point") {
          const pointLatLng: [number, number] = [geo.coordinates[1], geo.coordinates[0]];
          const tipo = props.tipo;
          const nome = props.nome || "Ponto";

          if (tipo === "TA") {
            const taAvailable = props.porta_disponivel === true;
            const taColor = taAvailable ? "#22c55e" : "#1a1a1a";
            L.circleMarker(pointLatLng, {
              radius: 4, fillColor: taColor, color: "#fff", weight: 1.5, fillOpacity: 0.95,
            }).addTo(map).bindTooltip(`<b>${nome}</b><br/>${taAvailable ? "🟢 Porta disponível" : "⚫ Saturado"}`, { sticky: true, direction: "top", opacity: 0.95 });
            bounds.extend(pointLatLng);
          } else if (tipo === "CE") {
            const ceCheck = r.providerRules ? evaluateConnectionAptness(props, r.providerRules) : { apto: false };
            const ceColor = ceCheck.apto ? "#22c55e" : "#f59e0b";
            const ceStatus = ceCheck.apto ? "🟢 CE apta" : `🟠 CE não apta${ceCheck.motivo ? ` (${ceCheck.motivo})` : ""}`;
            L.circleMarker(pointLatLng, {
              radius: 3, fillColor: ceColor, color: "#fff", weight: 1, fillOpacity: 0.85,
            }).addTo(map).bindTooltip(`<b>${nome}</b><br/>${ceStatus}${props.tem_splitter ? ` | ${props.splitter_portas_livres ?? '?'} portas livres` : ''}`, { sticky: true, direction: "top", opacity: 0.95 });
            bounds.extend(pointLatLng);
          }
        } else {
          const isCPFL = props.tipo === "EXCLUSAO_CPFL";
          const layer = L.geoJSON(
            { type: "Feature", geometry: geo, properties: props } as any,
            {
              style: () => {
                const color = isCPFL ? "#ef4444" : (props.stroke || r.providerColor);
                const weight = isCPFL ? 2 : (isConvertedPolygon ? 2 : (props["stroke-width"] || 3));
                const fillOpacity = isCPFL ? 0.3 : ((geo.type === "Polygon" || geo.type === "MultiPolygon") ? 0.25 : 0.2);
                return { color, weight, opacity: 0.8, fillColor: color, fillOpacity, dashArray: isCPFL ? "8 4" : undefined };
              },
            }
          ).addTo(map);
          const layerBounds = layer.getBounds();
          if (layerBounds.isValid()) bounds.extend(layerBounds);
        }
      } catch {}
    }

    if ((r.status !== "inside" || r.isOwnNetwork) && r.nearestPoint && r.routeGeometry) {
      const routeColor = r.isOwnNetwork ? "#3b82f6" : r.status === "outside_viable" ? "#22c55e" : "#ef4444";

      L.geoJSON(r.routeGeometry, {
        style: () => ({ color: routeColor, weight: 4, opacity: 0.8, dashArray: "10 6" }),
      }).addTo(map);

      const midLat = (r.lat + r.nearestPoint[0]) / 2;
      const midLng = (r.lng + r.nearestPoint[1]) / 2;
      L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: "distance-label",
          html: `<div style="background:${routeColor};color:white;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:bold;white-space:nowrap;">${r.distance}m</div>`,
          iconSize: [80, 24], iconAnchor: [40, 12],
        }),
      }).addTo(map);

      bounds.extend(L.latLng(r.nearestPoint[0], r.nearestPoint[1]));
    }

    if (r.nearestPoint) {
      const taLabel = r.taResult ? `<b>${r.taResult.tipo}: ${r.taResult.nome}</b><br/>${r.taResult.aptoNovoCliente ? "✅ Apto" : "⚠️ Não apto"}${r.taResult.motivoBloqueio ? `<br/><small>${r.taResult.motivoBloqueio}</small>` : ""}` : `<b>Rede ${r.providerName}</b>`;
      const taColor = r.taResult ? (r.taResult.aptoNovoCliente ? "#22c55e" : "#f59e0b") : r.providerColor;
      L.circleMarker(r.nearestPoint, {
        radius: 5, fillColor: taColor, color: "#fff", weight: 1.5, fillOpacity: 0.9,
      }).addTo(map).bindPopup(taLabel);
      bounds.extend(L.latLng(r.nearestPoint[0], r.nearestPoint[1]));
    }

    if (r.status === "inside" && !r.isOwnNetwork) {
      map.setView([r.lat, r.lng], mapZoom);
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: mapZoom });
    }

    const timer = window.setTimeout(() => {
      if (!mapRef.current) return;
      mapRef.current.invalidateSize();
      if (r.status === "inside" && !r.isOwnNetwork) {
        mapRef.current.setView([r.lat, r.lng], mapZoom);
      } else if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: mapZoom });
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [showMap, mapZoom, r, allGeoElements]);

  // Badge config
  const getBadgeConfig = () => {
    if (r.cpflBlocked) {
      return { label: "BLOQUEADO - CPFL", variant: "destructive" as const, icon: Ban, color: "text-red-600" };
    }
    if (r.highwayBlocked) {
      return { label: "BLOQUEADO - RODOVIA/FERROVIA", variant: "destructive" as const, icon: Ban, color: "text-red-600" };
    }
    if (r.isOwnNetwork && r.status === "outside_viable") {
      return { label: "REDE PRÓPRIA - VIÁVEL", variant: "secondary" as const, icon: CheckCircle, color: "text-blue-600" };
    }
    if (r.status === "check_om") {
      return { label: "CHECAR O&M DISPONIBILIDADE", variant: "outline" as const, icon: AlertTriangle, color: "text-yellow-600" };
    }
    if (r.isOwnNetwork && r.status === "outside_not_viable") {
      return { label: "REDE PRÓPRIA - NÃO ATENDE", variant: "destructive" as const, icon: Ban, color: "text-red-600" };
    }
    if (r.status === "inside") {
      return { label: "DENTRO DA COBERTURA", variant: "default" as const, icon: CheckCircle, color: "text-green-600" };
    }
    if (r.status === "outside_viable") {
      return { label: "VIÁVEL", variant: "default" as const, icon: CheckCircle, color: "text-green-600" };
    }
    return { label: "FORA DO LPU", variant: "destructive" as const, icon: XCircle, color: "text-red-600" };
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  return (
    <Card className="border-l-4 overflow-hidden" style={{ borderLeftColor: r.isOwnNetwork ? "#3b82f6" : r.providerColor }}>
      <CardContent className="pt-4 space-y-3">
        <div ref={cardRef} className="space-y-3 bg-background p-2 rounded">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: r.isOwnNetwork ? "#3b82f6" : r.providerColor }} />
              <span className="font-semibold text-lg">{r.providerName}</span>
              {r.hasCrossNtt && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Building2 className="h-3 w-3" /> Cross NTT
                </Badge>
              )}
            </div>
            <Badge variant={config.variant} className="gap-1">
              <Icon className="h-3.5 w-3.5" />
              {config.label}
            </Badge>
          </div>

          <div ref={mapContainerRef} style={{ width: "100%", height: "200px" }} className="rounded-lg overflow-hidden border" />

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {/* CPFL block takes priority */}
              {r.cpflBlocked && (
                <p className="col-span-2 text-sm font-bold text-destructive bg-destructive/10 p-3 rounded">
                  🚫 {r.cpflMessage}
                </p>
              )}
              {/* Highway/Railway block */}
              {!r.cpflBlocked && r.highwayBlocked && (
                <p className="col-span-2 text-sm font-bold text-destructive bg-destructive/10 p-3 rounded">
                  🚫 {r.highwayMessage}
                </p>
              )}
              {r.isOwnNetwork && r.taResult && !r.cpflBlocked && !r.highwayBlocked && (
                <>
                  <p className="col-span-2">
                    <span className="text-muted-foreground">{r.taResult.tipo} destino:</span>{" "}
                    <strong>{r.taResult.nome}</strong>
                    <Badge variant={r.taResult.aptoNovoCliente ? "default" : "destructive"} className="ml-2 text-xs">
                      {r.taResult.aptoNovoCliente ? "Apto para ativação" : "Não apto"}
                    </Badge>
                  </p>
                  {r.taResult.motivoBloqueio && (
                    <p className="col-span-2 text-xs text-muted-foreground">
                      ⚠️ {r.taResult.motivoBloqueio}
                    </p>
                  )}
                  <p className="col-span-2 text-xs text-muted-foreground">
                    {r.taResult.motivo === "mais_proximo" && `📍 ${r.taResult.tipo} mais próximo apto`}
                    {r.taResult.motivo === "verde_mais_proximo" && `🟢 ${r.taResult.tipo} verde mais próximo (o mais perto estava saturado)`}
                    {r.taResult.motivo === "fallback_saturado" && `⚠️ Nenhum ${r.taResult.tipo} com porta disponível no raio — usando o mais próximo (saturado)`}
                    {r.taResult.motivo === "sem_apto" && "⚠️ Nenhum ponto apto pelas regras atuais — usando o mais próximo para referência"}
                  </p>
                  {r.taResult.mensagem && (
                    <p className="col-span-2 text-sm font-medium text-destructive bg-destructive/10 p-2 rounded">
                      ⚠️ {r.taResult.mensagem}
                    </p>
                  )}
                </>
              )}
              {r.isOwnNetwork && r.status === "outside_viable" ? (
                <>
                  <p className="col-span-2">
                    <span className="text-muted-foreground">Distância até o TA:</span>{" "}
                    <strong className="text-blue-600">{r.distance}m</strong>
                    <span className="text-muted-foreground ml-2">(máx: {r.maxDistance}m)</span>
                  </p>
                </>
              ) : r.isOwnNetwork && r.status === "check_om" ? (
                <>
                  <p className="col-span-2 text-sm font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 p-3 rounded border border-yellow-300 dark:border-yellow-700">
                    ⚠️ Caixa próxima ao cliente, porém indisponível. Checar com O&amp;M a disponibilidade da mesma.
                  </p>
                  {r.checkOmBoxName && (
                    <p className="col-span-2 text-sm">
                      <span className="text-muted-foreground">Caixa referência:</span>{" "}
                      <strong>{r.checkOmBoxName}</strong>
                    </p>
                  )}
                </>
              ) : r.isOwnNetwork && r.status === "outside_not_viable" ? (
                <>
                  <p className="col-span-2">
                    <span className="text-muted-foreground">Distância até o TA:</span>{" "}
                    <strong className="text-destructive">{r.distance}m</strong>
                    <span className="text-muted-foreground ml-2">(máx: {r.maxDistance}m)</span>
                  </p>
                  <p className="col-span-2 text-sm text-destructive font-medium">
                    ❌ Distância excede o limite configurado.
                  </p>
                </>
              ) : r.isOwnNetwork && r.status === "inside" ? (
                <p className="col-span-2 font-medium" style={{ color: "#22c55e" }}>📍 Cliente dentro da cobertura — distância: 0m</p>
              ) : r.status === "inside" ? (
                <p className="col-span-2 font-medium" style={{ color: "#22c55e" }}>📍 Cliente está dentro da área de cobertura — distância: 0m</p>
            ) : (
              <>
                <p><span className="text-muted-foreground">Distância:</span> <strong style={{ color: "#22c55e" }}>{r.distance}m</strong></p>
                <p><span className="text-muted-foreground">Máx. permitida:</span> {r.maxDistance}m</p>
              </>
            )}
            {!r.isOwnNetwork && (
              <>
                <p><span className="text-muted-foreground">Tipo link:</span> {r.lpuType}</p>
                <p><span className="text-muted-foreground">LPU:</span> R$ {r.lpuValue.toFixed(2)}</p>
                <p className="col-span-2"><span className="text-muted-foreground">Valor Mínimo:</span> <strong className="text-lg">R$ {r.finalValue.toFixed(2)}</strong></p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => shareWithImage("whatsapp")} disabled={capturing}>
            {capturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => shareWithImage("email")} disabled={capturing}>
            {capturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />} Email
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
