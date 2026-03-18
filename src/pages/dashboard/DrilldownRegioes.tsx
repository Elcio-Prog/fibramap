import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDrilldownItems, PeriodFilter } from "@/hooks/useDashboardData";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const loadHeat = () => import("leaflet.heat");

export default function DrilldownRegioes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const period = (searchParams.get("period") || "30d") as PeriodFilter;
  const customFrom = searchParams.get("from") || "";
  const customTo = searchParams.get("to") || "";
  const customRange = period === "custom" && customFrom && customTo
    ? { from: new Date(customFrom), to: new Date(customTo + "T23:59:59") } : undefined;

  const { data: items, isLoading } = useDrilldownItems(period, customRange);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const cityCounts: Record<string, number> = {};
  (items || []).forEach((i: any) => { const city = i.cidade_a || "Não informada"; cityCounts[city] = (cityCounts[city] || 0) + 1; });
  const sorted = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((s, [, c]) => s + c, 0);

  const points = (items || []).filter((i: any) => i.lat_a != null && i.lng_a != null);
  const filteredPoints = selectedCity ? points.filter((i: any) => (i.cidade_a || "Não informada") === selectedCity) : points;

  useEffect(() => {
    if (!mapRef.current || isLoading) return;
    loadHeat().then(() => {
      if (mapInstance.current) mapInstance.current.remove();
      const map = L.map(mapRef.current!, { zoomControl: true, attributionControl: false }).setView([-15.78, -47.93], 4);
      mapInstance.current = map;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution: "© CARTO" }).addTo(map);
      if (filteredPoints.length > 0) {
        const heatData: [number, number, number][] = filteredPoints.map((i: any) => [Number(i.lat_a), Number(i.lng_a), 1]);
        // @ts-ignore
        L.heatLayer(heatData, {
          radius: 20, blur: 18, maxZoom: 12,
          gradient: { 0.2: "#3b82f6", 0.4: "#8b5cf6", 0.6: "#a855f7", 0.8: "#ec4899", 1: "#ef4444" },
        }).addTo(map);
        const bounds = L.latLngBounds(filteredPoints.map((i: any) => [Number(i.lat_a), Number(i.lng_a)]));
        map.fitBounds(bounds, { padding: [30, 30] });
      }
      setTimeout(() => map.invalidateSize(), 300);
    });
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [filteredPoints.length, isLoading, selectedCity]);

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(var(--dash-bg))" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-[hsl(var(--dash-text))] hover:bg-[hsl(var(--dash-card))]"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold text-[hsl(var(--dash-text))]">Mapa & Regiões</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--dash-text-muted))]" /></div>
        ) : (
          <>
            <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3 flex items-center gap-2">
                Mapa de Calor
                {selectedCity && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-[hsl(var(--dash-text-muted))]" onClick={() => setSelectedCity(null)}>
                    Limpar: {selectedCity}
                  </Button>
                )}
              </h3>
              <div ref={mapRef} className="h-[400px] rounded-lg overflow-hidden" />
            </div>

            <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3">Ranking por Cidade</h3>
              <Table>
                <TableHeader>
                  <TableRow className="border-[hsl(var(--dash-border))]">
                    <TableHead className="text-[hsl(var(--dash-text-muted))]">#</TableHead>
                    <TableHead className="text-[hsl(var(--dash-text-muted))]">Cidade</TableHead>
                    <TableHead className="text-[hsl(var(--dash-text-muted))] text-right">Total</TableHead>
                    <TableHead className="text-[hsl(var(--dash-text-muted))] text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(([city, count], i) => (
                    <TableRow key={city} className="cursor-pointer border-[hsl(var(--dash-border))] hover:bg-[hsl(var(--dash-card-hover))]" onClick={() => setSelectedCity(city === selectedCity ? null : city)}>
                      <TableCell className="text-[hsl(var(--dash-text))]">{i + 1}</TableCell>
                      <TableCell className="text-[hsl(var(--dash-text))] font-medium">{city}</TableCell>
                      <TableCell className="text-right text-[hsl(var(--dash-text))]">{count}</TableCell>
                      <TableCell className="text-right text-[hsl(var(--dash-text-muted))]">{((count / grandTotal) * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                  {sorted.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-[hsl(var(--dash-text-muted))]">Nenhum dado encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
