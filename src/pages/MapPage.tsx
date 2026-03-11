import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useProviders } from "@/hooks/useProviders";
import { useGeoElements, useBulkCreateGeoElements, useDeleteGeoElementsByProvider } from "@/hooks/useGeoElements";
import { useComprasLM } from "@/hooks/useComprasLM";
import { parseKML, parseKMZ, parseGeoJSON, getGeometryType, closedLineToPolygon } from "@/lib/geo-utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Layers, Eye, EyeOff, Database, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";
import { useUserRole } from "@/hooks/useUserRole";
import MapSearchBar from "@/components/map/MapSearchBar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const deleteByProvider = useDeleteGeoElementsByProvider();
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  // Start with ALL layers OFF for performance
  const [visibleProviders, setVisibleProviders] = useState<Set<string>>(new Set());
  const [showLMLayer, setShowLMLayer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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

  // Render geo elements on map — only for visible providers (lazy)
  useEffect(() => {
    if (!mapInstance.current || !geoElements || !providers) return;

    const providerMap = new Map(providers.map((p) => [p.id, p]));

    // Only build layers for visible providers
    for (const providerId of visibleProviders) {
      const provider = providerMap.get(providerId);
      if (!provider) continue;

      // Skip if layer already built
      if (layerGroups.current[providerId] && mapInstance.current.hasLayer(layerGroups.current[providerId])) continue;

      const lg = L.layerGroup();
      const providerElements = geoElements.filter((e) => e.provider_id === providerId);

      for (const el of providerElements) {
        const providerColor = provider.color;
        const rawGeo = el.geometry as any;
        const geo = closedLineToPolygon(rawGeo);
        const props = (el.properties as Record<string, any>) || {};
        const isConvertedPolygon = geo.type !== rawGeo.type;

        try {
          const layer = L.geoJSON(
            { type: "Feature", geometry: geo, properties: props } as any,
            {
              style: () => {
                const isCPFL = props.tipo === "EXCLUSAO_CPFL";
                const color = isCPFL ? "#ef4444" : (props.stroke || providerColor);
                const weight = isCPFL ? 2 : (isConvertedPolygon ? 2 : (props["stroke-width"] || 3));
                const fillOpacity = isCPFL ? 0.3 : ((geo.type === "Polygon" || geo.type === "MultiPolygon") ? 0.25 : 0.2);
                return { color, weight, opacity: 0.8, fillColor: color, fillOpacity, dashArray: isCPFL ? "8 4" : undefined };
              },
              pointToLayer: (_f, latlng) => {
                const fp = (_f.properties as any) || {};
                // TA/CE point rendering
                if (fp.tipo === "TA") {
                  const isGreen = fp.porta_disponivel === true;
                  const color = isGreen ? "#22c55e" : "#1a1a1a";
                  const label = fp.nome || "TA";
                  return L.circleMarker(latlng, {
                    radius: 4, fillColor: color, color: "#fff", weight: 1.5, fillOpacity: 0.95,
                  }).bindTooltip(`<b>${label}</b><br/>${isGreen ? "🟢 Porta disponível" : "⚫ Saturado"}`, { sticky: true, direction: "top", opacity: 0.95 });
                }
                if (fp.tipo === "CE") {
                  const label = fp.nome || "CE";
                  return L.circleMarker(latlng, {
                    radius: 3, fillColor: "#f59e0b", color: "#fff", weight: 1, fillOpacity: 0.85,
                  }).bindTooltip(`<b>${label}</b><br/>Caixa de Emenda${fp.tem_splitter ? `<br/>Splitter: ${fp.splitter_portas_livres ?? '?'} portas livres` : ''}`, { sticky: true, direction: "top", opacity: 0.95 });
                }
                if (fp.tipo === "EXCLUSAO_CPFL") {
                  // CPFL exclusion polygons are handled as regular polygons below with special styling
                }
                const pColor = fp.stroke || providerColor;
                return L.circleMarker(latlng, { radius: 3, fillColor: pColor, color: "#fff", weight: 1.5, fillOpacity: 0.9 });
              },
              onEachFeature: (_f, layer) => {
                const fp = (_f.properties as any) || {};
                const name = fp.nome || fp.name || fp.Name || el.element_type;
                const tipoLabel = fp.tipo === "TA" ? (fp.porta_disponivel ? "TA (porta disponível)" : "TA (saturado)") : fp.tipo === "CE" ? "Caixa de Emenda" : fp.tipo === "CABO" ? "Cabo" : el.element_type;
                const content = `<b>${provider.name}</b><br/>${name}<br/><small>${tipoLabel}</small>`;
                layer.bindPopup(content);
                if (!fp.tipo || (fp.tipo !== "TA" && fp.tipo !== "CE")) {
                  layer.bindTooltip(`<b>${provider.name}</b><br/>${name}`, { sticky: true, direction: "top", opacity: 0.95 });
                }
              },
            }
          );
          lg.addLayer(layer);
        } catch {}
      }

      layerGroups.current[providerId] = lg;
      lg.addTo(mapInstance.current);
    }

    // Remove layers that are no longer visible
    for (const [id, lg] of Object.entries(layerGroups.current)) {
      if (!visibleProviders.has(id) && mapInstance.current.hasLayer(lg)) {
        lg.removeFrom(mapInstance.current);
      }
    }
  }, [geoElements, providers, visibleProviders]);

  // Render LM layer
  useEffect(() => {
    if (!mapInstance.current || !comprasLM) return;
    if (lmLayerRef.current) { lmLayerRef.current.clearLayers(); }
    else { lmLayerRef.current = L.layerGroup(); }

    if (!showLMLayer) {
      lmLayerRef.current.removeFrom(mapInstance.current);
      return;
    }

    for (const r of comprasLM) {
      if (!r.lat || !r.lng) continue;
      const color = r.status?.toUpperCase() === "ATIVO" ? "#2ecc71" : "#e74c3c";
      const precoMbps = r.banda_mbps && r.banda_mbps > 0 ? `<br/>R$/Mbps: ${(r.valor_mensal / r.banda_mbps).toFixed(2)}` : "";
      const tooltipText = `<b>${r.parceiro}</b>${r.cliente ? `<br/>${r.cliente}` : ""}${r.banda_mbps ? `<br/>${r.banda_mbps} Mbps` : ""}<br/>R$ ${r.valor_mensal.toFixed(2)}`;
      const marker = L.circleMarker([r.lat, r.lng], {
        radius: 4, fillColor: color, color: "#fff", weight: 1.5, fillOpacity: 0.85,
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

    lmLayerRef.current.addTo(mapInstance.current);
  }, [comprasLM, showLMLayer]);

  const toggleProvider = (id: string) => {
    setVisibleProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Remove and clear cached layer
        layerGroups.current[id]?.removeFrom(mapInstance.current!);
        layerGroups.current[id]?.clearLayers();
        delete layerGroups.current[id];
      } else {
        next.add(id);
        // Layer will be built in the useEffect
      }
      return next;
    });
  };

  const handleDeleteLayer = async () => {
    if (!deleteTarget) return;
    try {
      await deleteByProvider.mutateAsync(deleteTarget.id);
      // Remove from map
      if (layerGroups.current[deleteTarget.id]) {
        layerGroups.current[deleteTarget.id].removeFrom(mapInstance.current!);
        layerGroups.current[deleteTarget.id].clearLayers();
        delete layerGroups.current[deleteTarget.id];
      }
      setVisibleProviders((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      toast({ title: `Camada "${deleteTarget.name}" removida com sucesso` });
    } catch (err: any) {
      toast({ title: "Erro ao remover camada", description: err.message, variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedProvider) {
      toast({ title: "Selecione um provedor antes de importar", variant: "destructive" });
      return;
    }

    try {
      let fc: GeoJSON.FeatureCollection;
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith(".kmz")) {
        const buffer = await file.arrayBuffer();
        fc = await parseKMZ(buffer);
      } else if (fileName.endsWith(".kml")) {
        const text = await file.text();
        fc = parseKML(text);
      } else {
        const text = await file.text();
        fc = parseGeoJSON(text);
      }

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

      await bulkCreate.mutateAsync(items);
      toast({ title: `${items.length} elementos importados!` });

      // Auto-enable and zoom to imported layer
      setVisibleProviders((prev) => new Set(prev).add(selectedProvider));

      if (mapInstance.current && fc.features.length > 0) {
        try {
          const geoLayer = L.geoJSON(fc as any);
          const bounds = geoLayer.getBounds();
          if (bounds.isValid()) {
            mapInstance.current.fitBounds(bounds, { padding: [40, 40] });
          }
        } catch {}
      }
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Check which providers have geo data
  const providersWithData = new Set(geoElements?.map((e) => e.provider_id) || []);

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
            <div key={p.id} className="flex items-center gap-1">
              <button
                onClick={() => toggleProvider(p.id)}
                className="flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="flex-1 text-left truncate">{p.name}</span>
                {visibleProviders.has(p.id) ? (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              {providersWithData.has(p.id) && (
                <button
                  onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                  className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Apagar camada"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="z-[3000]">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar camada</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar todos os elementos geográficos (rede/mancha) do provedor <strong>{deleteTarget?.name}</strong>? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLayer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Apagar camada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
