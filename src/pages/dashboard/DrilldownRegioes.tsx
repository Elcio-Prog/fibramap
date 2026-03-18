import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDrilldownItems, PeriodFilter } from "@/hooks/useDashboardData";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Dynamic import of leaflet.heat
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

  // City ranking
  const cityCounts: Record<string, number> = {};
  (items || []).forEach((i: any) => {
    const city = i.cidade_a || "Não informada";
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });
  const sorted = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((s, [, c]) => s + c, 0);

  // Points with valid coords
  const points = (items || []).filter((i: any) => i.lat_a != null && i.lng_a != null);
  const filteredPoints = selectedCity
    ? points.filter((i: any) => (i.cidade_a || "Não informada") === selectedCity)
    : points;

  useEffect(() => {
    if (!mapRef.current || isLoading) return;

    loadHeat().then(() => {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }

      const map = L.map(mapRef.current!, { zoomControl: true }).setView([-15.78, -47.93], 4);
      mapInstance.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      if (filteredPoints.length > 0) {
        const heatData: [number, number, number][] = filteredPoints.map((i: any) => [
          Number(i.lat_a), Number(i.lng_a), 1,
        ]);

        // @ts-ignore - leaflet.heat adds L.heatLayer
        const heat = L.heatLayer(heatData, { radius: 20, blur: 15, maxZoom: 12 });
        heat.addTo(map);

        const bounds = L.latLngBounds(filteredPoints.map((i: any) => [Number(i.lat_a), Number(i.lng_a)]));
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [filteredPoints.length, isLoading, selectedCity]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold">Mapa & Regiões</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Mapa de Calor
                {selectedCity && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedCity(null)}>
                    Limpar filtro: {selectedCity}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={mapRef} className="h-[400px] rounded-lg border" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Ranking por Cidade</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(([city, count], i) => (
                    <TableRow
                      key={city}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedCity(city === selectedCity ? null : city)}
                      data-state={city === selectedCity ? "selected" : undefined}
                    >
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{city}</TableCell>
                      <TableCell className="text-right">{count}</TableCell>
                      <TableCell className="text-right">{((count / grandTotal) * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                  {sorted.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum dado encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
