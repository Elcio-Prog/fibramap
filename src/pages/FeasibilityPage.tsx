import { useState, useEffect, useRef, useCallback } from "react";
import { useProviders } from "@/hooks/useProviders";
import { useGeoElements } from "@/hooks/useGeoElements";
import { useLpuItems } from "@/hooks/useLpuItems";
import { useCreateFeasibility } from "@/hooks/useFeasibility";
import { useAuth } from "@/contexts/AuthContext";
import {
  geocodeAddress,
  findNearestPoint,
  getRouteDistance,
  isInsideCoverage,
  findNearestBoundaryPoint,
  haversineDistance,
} from "@/lib/geo-utils";
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
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, Share2, CheckCircle, XCircle, Loader2, Ban } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type ResultStatus = "inside" | "outside_viable" | "outside_not_viable" | "too_far";

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
}

export default function FeasibilityPage() {
  const { data: providers } = useProviders();
  const { data: allGeoElements } = useGeoElements();
  const { data: allLpuItems } = useLpuItems();
  const createFeasibility = useCreateFeasibility();
  const { user } = useAuth();
  const { toast } = useToast();

  const [address, setAddress] = useState("");
  const [selectedLpuType, setSelectedLpuType] = useState("");
  const [customMultiplier, setCustomMultiplier] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FeasibilityResult[]>([]);

  const handleCalculate = async () => {
    if (!address.trim()) {
      toast({ title: "Digite um endereço", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const geo = await geocodeAddress(address);
      if (!geo) {
        toast({ title: "Endereço não encontrado", variant: "destructive" });
        return;
      }

      if (!providers?.length || !allGeoElements?.length) {
        toast({ title: "Cadastre provedores e importe dados antes", variant: "destructive" });
        return;
      }

      const newResults: FeasibilityResult[] = [];

      for (const provider of providers) {
        const providerElements = allGeoElements.filter((e) => e.provider_id === provider.id);
        if (!providerElements.length) continue;

        // Check if client is inside coverage polygon
        const inside = isInsideCoverage(geo.lat, geo.lng, providerElements);

        // Find LPU value
        const providerLpu = allLpuItems?.filter((l) => l.provider_id === provider.id) || [];
        let lpuItem = providerLpu.find((l) => l.link_type === selectedLpuType);
        if (!lpuItem && providerLpu.length > 0) lpuItem = providerLpu[0];
        const lpuValue = lpuItem?.value || 0;
        const mult = customMultiplier ? parseFloat(customMultiplier) : provider.multiplier;
        const finalValue = lpuValue * mult;
        const maxDist = provider.max_lpu_distance_m;

        if (inside) {
          // Client is inside coverage - viable, distance = 0
          const result: FeasibilityResult = {
            address: geo.display,
            lat: geo.lat,
            lng: geo.lng,
            providerName: provider.name,
            providerColor: provider.color,
            distance: 0,
            maxDistance: maxDist,
            lpuValue,
            lpuType: lpuItem?.link_type || "N/A",
            multiplier: mult,
            finalValue: Math.round(finalValue * 100) / 100,
            status: "inside",
            providerId: provider.id,
          };
          newResults.push(result);

          await createFeasibility.mutateAsync({
            user_id: user?.id,
            customer_address: address,
            customer_lat: geo.lat,
            customer_lng: geo.lng,
            provider_id: provider.id,
            calculated_distance_m: 0,
            lpu_value: lpuValue,
            multiplier: mult,
            final_value: finalValue,
            is_viable: true,
          });
        } else {
          // Client is outside coverage - calculate distance to nearest boundary
          const nearest = findNearestBoundaryPoint(geo.lat, geo.lng, providerElements);
          if (!nearest) continue;

          // Also try nearest point (for non-polygon elements like lines/points)
          const nearestAny = findNearestPoint(
            geo.lat,
            geo.lng,
            providerElements.map((e) => ({ geometry: e.geometry, provider_id: e.provider_id, properties: e.properties }))
          );

          const bestNearest = nearestAny && nearestAny.distance < nearest.distance ? nearestAny : nearest;
          let distance = bestNearest.distance;

          // Try OSRM route
          let routeGeometry: any = null;
          try {
            const route = await getRouteDistance(geo.lat, geo.lng, bestNearest.point[0], bestNearest.point[1]);
            if (route) {
              distance = route.distance;
              routeGeometry = route.geometry;
            }
          } catch {}

          // If distance > 2x max, don't even show map - just "denied"
          const tooFar = distance > maxDist * 2;
          const isViable = distance <= maxDist;

          const status: ResultStatus = tooFar ? "too_far" : isViable ? "outside_viable" : "outside_not_viable";

          const result: FeasibilityResult = {
            address: geo.display,
            lat: geo.lat,
            lng: geo.lng,
            providerName: provider.name,
            providerColor: provider.color,
            distance: Math.round(distance),
            maxDistance: maxDist,
            lpuValue,
            lpuType: lpuItem?.link_type || "N/A",
            multiplier: mult,
            finalValue: Math.round(finalValue * 100) / 100,
            status,
            providerId: provider.id,
            routeGeometry,
            nearestPoint: bestNearest.point,
          };

          newResults.push(result);

          await createFeasibility.mutateAsync({
            user_id: user?.id,
            customer_address: address,
            customer_lat: geo.lat,
            customer_lng: geo.lng,
            provider_id: provider.id,
            calculated_distance_m: Math.round(distance),
            lpu_value: lpuValue,
            multiplier: mult,
            final_value: finalValue,
            is_viable: isViable,
          });
        }
      }

      // Sort: inside first, then viable, then not viable, then too far
      const order: Record<ResultStatus, number> = { inside: 0, outside_viable: 1, outside_not_viable: 2, too_far: 3 };
      setResults(newResults.sort((a, b) => order[a.status] - order[b.status] || a.distance - b.distance));

      if (newResults.length === 0) {
        toast({ title: "Nenhum provedor com dados geográficos importados" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const shareResult = (r: FeasibilityResult, via: "whatsapp" | "email") => {
    const statusText = r.status === "inside" ? "✅ DENTRO DA COBERTURA" : r.status === "outside_viable" ? "✅ VIÁVEL" : r.status === "outside_not_viable" ? "⚠️ FORA DO LPU" : "❌ SEM COBERTURA";
    const text = `📍 Viabilidade de Fibra\n\nEndereço: ${r.address}\nProvedor: ${r.providerName}\nStatus: ${statusText}\nDistância: ${r.distance}m (máx ${r.maxDistance}m)\nTipo: ${r.lpuType}\nValor LPU: R$ ${r.lpuValue.toFixed(2)}\nMultiplicador: ${r.multiplier}\nValor Final: R$ ${r.finalValue.toFixed(2)}`;

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
            <MapPin className="h-5 w-5" /> Endereço do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Endereço</Label>
            <Input
              placeholder="Ex: Rua das Flores, 123, São Paulo"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
            />
          </div>

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
              <Input
                type="number"
                step="0.01"
                placeholder="Usar padrão do provedor"
                value={customMultiplier}
                onChange={(e) => setCustomMultiplier(e.target.value)}
              />
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
          <h2 className="text-lg font-semibold">Resultados ({results.length} provedores)</h2>
          {results.map((r, i) => (
            <ResultCard key={i} result={r} allGeoElements={allGeoElements || []} onShare={shareResult} />
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
}: {
  result: FeasibilityResult;
  allGeoElements: any[];
  onShare: (r: FeasibilityResult, via: "whatsapp" | "email") => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const statusConfig: Record<ResultStatus, { label: string; variant: "default" | "destructive" | "secondary" | "outline"; icon: any; color: string }> = {
    inside: { label: "DENTRO DA COBERTURA", variant: "default", icon: CheckCircle, color: "text-green-600" },
    outside_viable: { label: "VIÁVEL", variant: "default", icon: CheckCircle, color: "text-green-600" },
    outside_not_viable: { label: "FORA DO LPU", variant: "destructive", icon: XCircle, color: "text-red-600" },
    too_far: { label: "SEM COBERTURA", variant: "destructive", icon: Ban, color: "text-red-600" },
  };

  const config = statusConfig[r.status];
  const Icon = config.icon;
  const showMap = r.status !== "too_far";

  useEffect(() => {
    if (!showMap || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView([r.lat, r.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    mapRef.current = map;

    // Customer marker
    L.marker([r.lat, r.lng]).addTo(map).bindPopup(`<b>Cliente</b><br/>${r.address}`);

    // Draw provider coverage polygons
    const providerElements = allGeoElements.filter((e) => e.provider_id === r.providerId);
    const bounds = L.latLngBounds([[r.lat, r.lng]]);

    for (const el of providerElements) {
      try {
        const geo = el.geometry as any;
        if (geo.type === "Polygon" || geo.type === "MultiPolygon") {
          const layer = L.geoJSON(
            { type: "Feature", geometry: geo, properties: {} } as any,
            {
              style: () => ({
                color: r.providerColor,
                weight: 2,
                opacity: 0.6,
                fillColor: r.providerColor,
                fillOpacity: 0.15,
              }),
            }
          ).addTo(map);
          bounds.extend(layer.getBounds());
        }
      } catch {}
    }

    // Draw route if outside coverage
    if (r.status !== "inside" && r.nearestPoint) {
      const routeColor = r.status === "outside_viable" ? "#22c55e" : "#ef4444";

      if (r.routeGeometry) {
        L.geoJSON(r.routeGeometry, {
          style: () => ({ color: routeColor, weight: 4, opacity: 0.8, dashArray: "10 6" }),
        }).addTo(map);
      } else {
        L.polyline([[r.lat, r.lng], r.nearestPoint], {
          color: routeColor,
          weight: 4,
          opacity: 0.8,
          dashArray: "10 6",
        }).addTo(map);
      }

      // Distance label
      const midLat = (r.lat + r.nearestPoint[0]) / 2;
      const midLng = (r.lng + r.nearestPoint[1]) / 2;
      L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: "distance-label",
          html: `<div style="background:${routeColor};color:white;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:bold;white-space:nowrap;">${r.distance}m</div>`,
          iconSize: [80, 24],
          iconAnchor: [40, 12],
        }),
      }).addTo(map);

      // Nearest point marker
      L.circleMarker(r.nearestPoint, {
        radius: 8,
        fillColor: r.providerColor,
        color: "#fff",
        weight: 2,
        fillOpacity: 0.9,
      }).addTo(map).bindPopup(`<b>Rede ${r.providerName}</b>`);

      bounds.extend(L.latLng(r.nearestPoint[0], r.nearestPoint[1]));
    }

    map.fitBounds(bounds, { padding: [30, 30] });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <Card className="border-l-4 overflow-hidden" style={{ borderLeftColor: r.providerColor }}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: r.providerColor }} />
            <span className="font-semibold text-lg">{r.providerName}</span>
          </div>
          <Badge variant={config.variant} className="gap-1">
            <Icon className="h-3.5 w-3.5" />
            {config.label}
          </Badge>
        </div>

        {r.status === "too_far" ? (
          <div className="text-center py-6 text-muted-foreground">
            <Ban className="h-12 w-12 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Viabilidade negada</p>
            <p className="text-sm">Nenhuma cobertura do provedor na região do cliente.</p>
            <p className="text-xs mt-1">Distância: {r.distance}m (máx {r.maxDistance}m)</p>
          </div>
        ) : (
          <>
            {showMap && (
              <div ref={mapContainerRef} className="h-48 w-full rounded-lg overflow-hidden border" />
            )}

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {r.status === "inside" ? (
                <p className="col-span-2 text-green-600 font-medium">📍 Cliente está dentro da área de cobertura</p>
              ) : (
                <>
                  <p><span className="text-muted-foreground">Distância:</span> <strong className={r.status === "outside_viable" ? "text-green-600" : "text-red-600"}>{r.distance}m</strong></p>
                  <p><span className="text-muted-foreground">Máx. permitida:</span> {r.maxDistance}m</p>
                </>
              )}
              <p><span className="text-muted-foreground">Tipo link:</span> {r.lpuType}</p>
              <p><span className="text-muted-foreground">Valor LPU:</span> R$ {r.lpuValue.toFixed(2)}</p>
              <p><span className="text-muted-foreground">Multiplicador:</span> {r.multiplier}</p>
              <p><span className="text-muted-foreground">Valor Final:</span> <strong className="text-lg">R$ {r.finalValue.toFixed(2)}</strong></p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onShare(r, "whatsapp")}>
                <Share2 className="h-3.5 w-3.5" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onShare(r, "email")}>
                <Share2 className="h-3.5 w-3.5" /> Email
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
