import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useProviders } from "@/hooks/useProviders";
import { useGeoElements, useBulkCreateGeoElements } from "@/hooks/useGeoElements";
import { useComprasLM } from "@/hooks/useComprasLM";
import { parseKML, parseKMZ, parseGeoJSON, getGeometryType } from "@/lib/geo-utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Layers, Eye, EyeOff, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerGroups = useRef<Record<string, L.LayerGroup>>({});
  const lmLayerRef = useRef<L.LayerGroup | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: providers } = useProviders();
  const { data: geoElements } = useGeoElements();
  const { data: comprasLM } = useComprasLM();
  const bulkCreate = useBulkCreateGeoElements();
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [visibleProviders, setVisibleProviders] = useState<Set<string>>(new Set());
  const [showLMLayer, setShowLMLayer] = useState(true);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current).setView([-14.235, -51.925], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    mapInstance.current = map;
    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update visible providers set
  useEffect(() => {
    if (providers) {
      setVisibleProviders(new Set(providers.map((p) => p.id)));
    }
  }, [providers]);

  // Render geo elements on map
  useEffect(() => {
    if (!mapInstance.current || !geoElements || !providers) return;

    // Clear existing layers
    Object.values(layerGroups.current).forEach((lg) => lg.clearLayers());

    const providerMap = new Map(providers.map((p) => [p.id, p]));

    for (const el of geoElements) {
      const provider = providerMap.get(el.provider_id);
      if (!provider) continue;

      if (!layerGroups.current[provider.id]) {
        layerGroups.current[provider.id] = L.layerGroup();
      }

      const color = provider.color;
      const geo = el.geometry as any;
      const props = (el.properties as Record<string, any>) || {};

      try {
        const layer = L.geoJSON(
          { type: "Feature", geometry: geo, properties: props } as any,
          {
            style: () => ({ color, weight: 3, opacity: 0.8, fillColor: color, fillOpacity: 0.2 }),
            pointToLayer: (_f, latlng) =>
              L.circleMarker(latlng, { radius: 6, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9 }),
            onEachFeature: (_f, layer) => {
              const name = props.name || props.Name || el.element_type;
              const content = `<b>${provider.name}</b><br/>${name}<br/><small>${el.element_type}</small>`;
              layer.bindPopup(content);
              layer.bindTooltip(`<b>${provider.name}</b><br/>${name}`, { sticky: true, direction: "top", opacity: 0.95 });
            },
          }
        );
        layerGroups.current[provider.id].addLayer(layer);
      } catch {}
    }

    // Add/remove from map based on visibility
    for (const [id, lg] of Object.entries(layerGroups.current)) {
      if (visibleProviders.has(id)) {
        lg.addTo(mapInstance.current!);
      } else {
        lg.removeFrom(mapInstance.current!);
      }
    }
  }, [geoElements, providers, visibleProviders]);

  // Render LM layer
  useEffect(() => {
    if (!mapInstance.current || !comprasLM) return;
    if (lmLayerRef.current) { lmLayerRef.current.clearLayers(); }
    else { lmLayerRef.current = L.layerGroup(); }

    for (const r of comprasLM) {
      if (!r.lat || !r.lng) continue;
      const color = r.status?.toUpperCase() === "ATIVO" ? "#2ecc71" : "#e74c3c";
      const precoMbps = r.banda_mbps && r.banda_mbps > 0 ? `<br/>R$/Mbps: ${(r.valor_mensal / r.banda_mbps).toFixed(2)}` : "";
      const tooltipText = `<b>${r.parceiro}</b>${r.cliente ? `<br/>${r.cliente}` : ""}${r.banda_mbps ? `<br/>${r.banda_mbps} Mbps` : ""}<br/>R$ ${r.valor_mensal.toFixed(2)}`;
      const marker = L.circleMarker([r.lat, r.lng], {
        radius: 5, fillColor: color, color: "#fff", weight: 1.5, fillOpacity: 0.85,
      }).bindTooltip(tooltipText, { sticky: true, direction: "top", opacity: 0.95 }).bindPopup(
        `<b>${r.parceiro}</b>` +
        `${r.cliente ? `<br/>Cliente: ${r.cliente}` : ""}` +
        `${r.banda_mbps ? `<br/>Banda: ${r.banda_mbps} Mbps` : ""}` +
        `<br/>Valor: R$ ${r.valor_mensal.toFixed(2)}` +
        precoMbps +
        `${r.nr_contrato ? `<br/>Contrato: ${r.nr_contrato}` : ""}` +
        `${r.id_etiqueta ? `<br/>Etiqueta: ${r.id_etiqueta}` : ""}` +
        `${r.status ? `<br/>Status: ${r.status}` : ""}` +
        `${r.codigo_sap ? `<br/>SAP: ${r.codigo_sap}` : ""}` +
        `<br/><small>${r.endereco}</small>`
      );
      lmLayerRef.current.addLayer(marker);
    }

    if (showLMLayer) lmLayerRef.current.addTo(mapInstance.current);
    else lmLayerRef.current.removeFrom(mapInstance.current);
  }, [comprasLM, showLMLayer]);

  const toggleProvider = (id: string) => {
    setVisibleProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        layerGroups.current[id]?.removeFrom(mapInstance.current!);
      } else {
        next.add(id);
        layerGroups.current[id]?.addTo(mapInstance.current!);
      }
      return next;
    });
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("[KML Import] File selected:", file?.name, "Provider:", selectedProvider);
    
    if (!file) {
      console.log("[KML Import] No file selected");
      return;
    }
    
    if (!selectedProvider) {
      toast({ title: "Selecione um provedor antes de importar", variant: "destructive" });
      return;
    }

    try {
      let fc: GeoJSON.FeatureCollection;
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith(".kmz")) {
        console.log("[KMZ Import] Parsing as KMZ...");
        const buffer = await file.arrayBuffer();
        fc = await parseKMZ(buffer);
      } else if (fileName.endsWith(".kml")) {
        const text = await file.text();
        console.log("[KML Import] Parsing as KML...");
        fc = parseKML(text);
      } else {
        const text = await file.text();
        console.log("[Import] Parsing as GeoJSON...");
        fc = parseGeoJSON(text);
      }

      console.log("[KML Import] Parsed features:", fc.features.length);
      console.log("[KML Import] Features with geometry:", fc.features.filter(f => f.geometry != null).length);

      const items = fc.features
        .filter((f) => f.geometry != null)
        .map((f) => ({
          provider_id: selectedProvider,
          element_type: getGeometryType(f.geometry),
          geometry: f.geometry as unknown as Json,
          properties: (f.properties || {}) as unknown as Json,
        }));

      if (items.length === 0) {
        toast({ title: "Nenhum elemento geográfico válido encontrado no arquivo", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      console.log("[KML Import] Inserting", items.length, "elements...");
      await bulkCreate.mutateAsync(items);
      toast({ title: `${items.length} elementos importados!` });
    } catch (err: any) {
      console.error("[KML Import] Error:", err);
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="relative flex h-full">
      {/* Map */}
      <div ref={mapRef} className="flex-1" />

      {/* Side panel */}
      <div className="absolute right-3 top-3 z-[1000] flex w-72 flex-col gap-3 rounded-xl bg-card/95 p-4 shadow-lg backdrop-blur-sm border">
        <h3 className="flex items-center gap-2 font-semibold">
          <Layers className="h-4 w-4" /> Camadas
        </h3>

        {/* Import controls */}
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Selecione o provedor" />
          </SelectTrigger>
          <SelectContent className="z-[2000]">
            {providers?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".kml,.KML,.kmz,.KMZ,.geojson,.json"
            className="hidden"
            onChange={handleFileImport}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Importar KML/GeoJSON
          </Button>
        </div>

        {/* Provider toggles */}
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {providers?.map((p) => (
            <button
              key={p.id}
              onClick={() => toggleProvider(p.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="flex-1 text-left truncate">{p.name}</span>
              {visibleProviders.has(p.id) ? (
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
        {/* LM Layer toggle */}
        <div className="border-t pt-2 mt-2">
          <button
            onClick={() => {
              setShowLMLayer(prev => {
                const next = !prev;
                if (next) lmLayerRef.current?.addTo(mapInstance.current!);
                else lmLayerRef.current?.removeFrom(mapInstance.current!);
                return next;
              });
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1 text-left">Compras LM</span>
            {showLMLayer ? (
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
