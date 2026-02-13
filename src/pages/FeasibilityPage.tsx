import { useState } from "react";
import { useProviders } from "@/hooks/useProviders";
import { useGeoElements } from "@/hooks/useGeoElements";
import { useLpuItems } from "@/hooks/useLpuItems";
import { useCreateFeasibility } from "@/hooks/useFeasibility";
import { useAuth } from "@/contexts/AuthContext";
import { geocodeAddress, findNearestPoint, getRouteDistance } from "@/lib/geo-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, Share2, CheckCircle, XCircle, Loader2 } from "lucide-react";

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
  isViable: boolean;
  providerId: string;
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

        const nearest = findNearestPoint(
          geo.lat,
          geo.lng,
          providerElements.map((e) => ({ geometry: e.geometry, provider_id: e.provider_id, properties: e.properties }))
        );
        if (!nearest) continue;

        // Try OSRM route, fallback to haversine
        let distance = nearest.distance;
        const route = await getRouteDistance(geo.lat, geo.lng, nearest.point[0], nearest.point[1]);
        if (route) distance = route.distance;

        const maxDist = provider.max_lpu_distance_m;
        const isViable = distance <= maxDist;

        // Find LPU value
        const providerLpu = allLpuItems?.filter((l) => l.provider_id === provider.id) || [];
        let lpuItem = providerLpu.find((l) => l.link_type === selectedLpuType);
        if (!lpuItem && providerLpu.length > 0) lpuItem = providerLpu[0];

        const lpuValue = lpuItem?.value || 0;
        const mult = customMultiplier ? parseFloat(customMultiplier) : provider.multiplier;
        const finalValue = lpuValue * mult;

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
          isViable,
          providerId: provider.id,
        };

        newResults.push(result);

        // Save to DB
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

      setResults(newResults.sort((a, b) => a.distance - b.distance));
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
    const text = `📍 Viabilidade de Fibra\n\nEndereço: ${r.address}\nProvedor: ${r.providerName}\nDistância: ${r.distance}m (máx ${r.maxDistance}m)\nViável: ${r.isViable ? "✅ SIM" : "❌ NÃO"}\nTipo: ${r.lpuType}\nValor LPU: R$ ${r.lpuValue.toFixed(2)}\nMultiplicador: ${r.multiplier}\nValor Final: R$ ${r.finalValue.toFixed(2)}`;

    if (via === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } else {
      window.open(`mailto:?subject=Viabilidade de Fibra - ${r.providerName}&body=${encodeURIComponent(text)}`, "_blank");
    }
  };

  // Get unique LPU types
  const lpuTypes = [...new Set(allLpuItems?.map((l) => l.link_type) || [])];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
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
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Resultados ({results.length} provedores)</h2>
          {results.map((r, i) => (
            <Card key={i} className={`border-l-4`} style={{ borderLeftColor: r.providerColor }}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full" style={{ backgroundColor: r.providerColor }} />
                    <span className="font-semibold text-lg">{r.providerName}</span>
                  </div>
                  <Badge variant={r.isViable ? "default" : "destructive"} className="gap-1">
                    {r.isViable ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {r.isViable ? "VIÁVEL" : "INVIÁVEL"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <p><span className="text-muted-foreground">Distância:</span> <strong>{r.distance}m</strong></p>
                  <p><span className="text-muted-foreground">Máx. permitida:</span> {r.maxDistance}m</p>
                  <p><span className="text-muted-foreground">Tipo link:</span> {r.lpuType}</p>
                  <p><span className="text-muted-foreground">Valor LPU:</span> R$ {r.lpuValue.toFixed(2)}</p>
                  <p><span className="text-muted-foreground">Multiplicador:</span> {r.multiplier}</p>
                  <p><span className="text-muted-foreground">Valor Final:</span> <strong className="text-lg">R$ {r.finalValue.toFixed(2)}</strong></p>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => shareResult(r, "whatsapp")}>
                    <Share2 className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => shareResult(r, "email")}>
                    <Share2 className="h-3.5 w-3.5" /> Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
