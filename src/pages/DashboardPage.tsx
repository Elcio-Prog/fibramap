import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, Users, Building2, MapPin, TrendingUp, TrendingDown, Loader2, Package, Radar, Navigation,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import { useDashboardKPIs, useDrilldownItems, useDrilldownLogs, useComparativoData, PeriodFilter, DateRange, getDateRange } from "@/hooks/useDashboardData";
import { format, eachDayOfInterval, eachWeekOfInterval, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const loadHeat = () => import("leaflet.heat");

const DARK_TOOLTIP_CLS = "!bg-[hsl(215,45%,13%)] !border-[hsl(215,40%,20%)] !text-[hsl(210,20%,92%)] [&_.text-muted-foreground]:!text-[hsl(215,20%,55%)]";
const CURSOR_STYLE = { fill: "hsl(215, 40%, 20%)", opacity: 0.3 };

const PERIODS: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "custom", label: "Personalizado" },
  { value: "total", label: "Total" },
];

const VIBRANT_COLORS = [
  "hsl(210, 100%, 55%)", "hsl(185, 90%, 50%)", "hsl(265, 85%, 60%)",
  "hsl(320, 85%, 55%)", "hsl(160, 70%, 45%)", "hsl(25, 95%, 55%)",
  "hsl(45, 90%, 55%)", "hsl(140, 70%, 50%)",
];

function VariationBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs opacity-50">N/A</span>;
  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

interface GradientKpiProps {
  title: string;
  value: string;
  subtitle?: string;
  variation?: number | null;
  icon: React.ElementType;
  gradient: string;
  onClick: () => void;
}

function GradientKpiCard({ title, value, subtitle, variation, icon: Icon, gradient, onClick }: GradientKpiProps) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
      style={{ background: gradient }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs font-medium text-white/70">{title}</p>
          <p className="text-2xl font-bold text-white tracking-tight truncate">{value}</p>
          {subtitle && <p className="text-xs text-white/60 truncate">{subtitle}</p>}
          {variation !== undefined && (
            <div className="pt-1">
              <VariationBadge value={variation ?? null} />
              <span className="text-[10px] text-white/40 ml-1">vs anterior</span>
            </div>
          )}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function DashChartCard({ title, children, onClick, className = "" }: { title: string; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4 ${onClick ? "cursor-pointer hover:border-[hsl(var(--dash-gradient-cyan)/.3)] transition-colors" : ""} ${className}`}
    >
      <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3">{title}</h3>
      {children}
    </div>
  );
}

// Heatmap component
function HeatmapPanel({ items, onClick }: { items: any[]; onClick?: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  const points = items.filter((i: any) => i.lat_a != null && i.lng_a != null);

  useEffect(() => {
    if (!mapRef.current) return;
    loadHeat().then(() => {
      if (mapInstance.current) mapInstance.current.remove();
      const map = L.map(mapRef.current!, { zoomControl: true, attributionControl: false }).setView([-15.78, -47.93], 4);
      mapInstance.current = map;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© CARTO",
      }).addTo(map);
      if (points.length > 0) {
        const heatData: [number, number, number][] = points.map((i: any) => [Number(i.lat_a), Number(i.lng_a), 1]);
        // @ts-ignore
        L.heatLayer(heatData, {
          radius: 20, blur: 18, maxZoom: 12,
          gradient: { 0.2: "#3b82f6", 0.4: "#8b5cf6", 0.6: "#a855f7", 0.8: "#ec4899", 1: "#ef4444" },
        }).addTo(map);
        const bounds = L.latLngBounds(points.map((i: any) => [Number(i.lat_a), Number(i.lng_a)]));
        map.fitBounds(bounds, { padding: [30, 30] });
      }
      setTimeout(() => map.invalidateSize(), 300);
    });
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [points.length]);

  return (
    <DashChartCard title="Mapa de Calor" onClick={onClick} className="col-span-6">
      <div ref={mapRef} className="h-[320px] rounded-lg overflow-hidden" />
    </DashChartCard>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const customRange: DateRange | undefined =
    period === "custom" && customFrom && customTo
      ? { from: new Date(customFrom), to: new Date(customTo + "T23:59:59") }
      : undefined;

  const { data, isLoading } = useDashboardKPIs(period, customRange);
  const { data: items } = useDrilldownItems(period, customRange);
  const { data: logs } = useDrilldownLogs(period, customRange);
  const { data: comparativoData } = useComparativoData();

  const periodParam = period === "custom" && customFrom && customTo
    ? `period=custom&from=${customFrom}&to=${customTo}`
    : `period=${period}`;

  const range = getDateRange(period, customRange);

  // Chart 1 — Evolution (Area)
  const evolutionData = (() => {
    if (!items?.length) return [];
    const days = eachDayOfInterval({ start: range.from, end: range.to });
    const countMap: Record<string, number> = {};
    items.forEach(i => {
      if (i.data_envio) {
        const key = format(new Date(i.data_envio), "yyyy-MM-dd");
        countMap[key] = (countMap[key] || 0) + 1;
      }
    });
    return days.slice(-60).map(d => ({
      label: format(d, "dd/MM"),
      total: countMap[format(d, "yyyy-MM-dd")] || 0,
    }));
  })();

  // Chart 2 — Lote vs Unitário (Lines)
  const loteVsUnitData = (() => {
    if (!logs?.length) return [];
    const days = eachDayOfInterval({ start: range.from, end: range.to });
    return days.slice(-60).map(d => {
      const dayStr = format(d, "yyyy-MM-dd");
      const dayLogs = logs.filter((l: any) => format(new Date(l.data_envio), "yyyy-MM-dd") === dayStr);
      const lote = dayLogs.filter((l: any) => l.quantidade_itens > 1).reduce((s: number, l: any) => s + l.quantidade_itens, 0);
      const unit = dayLogs.filter((l: any) => l.quantidade_itens === 1).length;
      return { label: format(d, "dd/MM"), lote, unitario: unit };
    });
  })();

  // Chart 3 — Comparativo (Bars)
  const comparativoChartData = (comparativoData || []).map((m, i) => ({
    label: format(new Date(m.month + "-01"), "MMM/yy", { locale: ptBR }),
    total: m.total,
    isCurrent: i === (comparativoData || []).length - 1,
  }));

  // Chart 4 — Donut providers
  const providerDonutData = (() => {
    if (!items?.length) return [];
    const counts: Record<string, number> = {};
    items.forEach((i: any) => {
      const p = i.result_provider || "Sem provedor";
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  })();
  const providerTotal = providerDonutData.reduce((s, d) => s + d.value, 0);

  // Chart 5 — Top solicitantes (Horizontal bars)
  const solicitantesData = (() => {
    if (!logs?.length) return [];
    const counts: Record<string, number> = {};
    logs.forEach((l: any) => { counts[l.usuario_email] = (counts[l.usuario_email] || 0) + l.quantidade_itens; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([email, count]) => ({
      name: email.split("@")[0],
      total: count,
    }));
  })();

  // Chart 6 — Top cidades (Vertical bars)
  const cidadesData = (() => {
    if (!items?.length) return [];
    const counts: Record<string, number> = {};
    items.forEach((i: any) => {
      const city = i.cidade_a || "N/I";
      counts[city] = (counts[city] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, total]) => ({ name, total }));
  })();

  const areaConfig = { total: { label: "Viabilidades", color: "hsl(210, 100%, 55%)" } };
  const loteConfig = { lote: { label: "Lote", color: "hsl(265, 85%, 60%)" }, unitario: { label: "Unitário", color: "hsl(320, 85%, 55%)" } };
  const compConfig = { total: { label: "Total", color: "hsl(185, 90%, 50%)" } };
  const solConfig = { total: { label: "Viabilidades", color: "hsl(265, 85%, 60%)" } };
  const cidConfig = { total: { label: "Consultas", color: "hsl(160, 70%, 45%)" } };

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(var(--dash-bg))" }}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header + Period Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-[hsl(var(--dash-text))]">Dashboard de Viabilidades</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg overflow-hidden border border-[hsl(var(--dash-border))]">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    period === p.value
                      ? "bg-[hsl(var(--primary))] text-white"
                      : "bg-[hsl(var(--dash-card))] text-[hsl(var(--dash-text-muted))] hover:bg-[hsl(var(--dash-card-hover))]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <>
                <Input type="date" className="h-8 w-[130px] text-xs bg-[hsl(var(--dash-card))] border-[hsl(var(--dash-border))] text-[hsl(var(--dash-text))]" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                <Input type="date" className="h-8 w-[130px] text-xs bg-[hsl(var(--dash-card))] border-[hsl(var(--dash-border))] text-[hsl(var(--dash-text))]" value={customTo} onChange={e => setCustomTo(e.target.value)} />
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--dash-text-muted))]" />
          </div>
        ) : (
          <>
            {/* 4 Gradient KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <GradientKpiCard
                title="Total de Viabilidades Enviadas"
                value={String(data?.total.current ?? 0)}
                variation={data?.total.variation}
                icon={Package}
                gradient="linear-gradient(135deg, hsl(210, 100%, 45%), hsl(210, 100%, 60%))"
                onClick={() => navigate(`/dashboard/volume?${periodParam}`)}
              />
              <GradientKpiCard
                title="Solicitante Mais Ativo"
                value={data?.topSolicitante?.email?.split("@")[0] ?? "—"}
                subtitle={data?.topSolicitante ? `${data.topSolicitante.count} viabilidades` : undefined}
                icon={Users}
                gradient="linear-gradient(135deg, hsl(185, 90%, 40%), hsl(185, 90%, 55%))"
                onClick={() => navigate(`/dashboard/solicitantes?${periodParam}`)}
              />
              <GradientKpiCard
                title="Provedor Mais Viável"
                value={data?.topProvider?.name ?? "—"}
                subtitle={data?.topProvider ? `${data.topProvider.count} aprovadas` : undefined}
                icon={Radar}
                gradient="linear-gradient(135deg, hsl(265, 85%, 50%), hsl(265, 85%, 65%))"
                onClick={() => navigate(`/dashboard/provedores?${periodParam}`)}
              />
              <GradientKpiCard
                title="Região Mais Consultada"
                value={data?.topCity?.name ?? "—"}
                subtitle={data?.topCity ? `${data.topCity.count} consultas` : undefined}
                icon={Navigation}
                gradient="linear-gradient(135deg, hsl(320, 85%, 45%), hsl(320, 85%, 60%))"
                onClick={() => navigate(`/dashboard/regioes?${periodParam}`)}
              />
            </div>

            {/* Chart 1 — Evolution (full width) */}
            <DashChartCard title="Evolução de Envios" onClick={() => navigate(`/dashboard/volume?${periodParam}`)}>
              <ChartContainer config={areaConfig} className="h-[280px] w-full">
                <AreaChart data={evolutionData}>
                  <defs>
                    <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(210, 100%, 55%)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(185, 90%, 50%)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 40%, 20%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                  <ChartTooltip cursor={CURSOR_STYLE} content={<ChartTooltipContent className={DARK_TOOLTIP_CLS} />} />
                  <Area type="monotone" dataKey="total" stroke="hsl(210, 100%, 55%)" strokeWidth={2} fill="url(#gradBlue)" />
                </AreaChart>
              </ChartContainer>
            </DashChartCard>

            {/* Row: Lote vs Unit + Comparativo */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <DashChartCard title="Lote vs. Busca Unitária" onClick={() => navigate(`/dashboard/lote-unitario?${periodParam}`)} className="lg:col-span-6">
                <ChartContainer config={loteConfig} className="h-[260px] w-full">
                  <LineChart data={loteVsUnitData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 40%, 20%)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                    <ChartTooltip cursor={CURSOR_STYLE} content={<ChartTooltipContent className={DARK_TOOLTIP_CLS} />} />
                    <Line type="monotone" dataKey="lote" stroke="hsl(265, 85%, 60%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="unitario" stroke="hsl(320, 85%, 55%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </DashChartCard>

              <DashChartCard title="Comparativo Mensal" onClick={() => navigate(`/dashboard/comparativo?${periodParam}`)} className="lg:col-span-6">
                <ChartContainer config={compConfig} className="h-[260px] w-full">
                  <BarChart data={comparativoChartData}>
                    <defs>
                      <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(185, 90%, 50%)" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="hsl(210, 100%, 55%)" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 40%, 20%)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                    <ChartTooltip cursor={CURSOR_STYLE} content={<ChartTooltipContent className={DARK_TOOLTIP_CLS} />} />
                    <Bar dataKey="total" fill="url(#gradCyan)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </DashChartCard>
            </div>

            {/* Row: Donut Providers + Solicitantes */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <DashChartCard title="Volume por Provedor" onClick={() => navigate(`/dashboard/provedores?${periodParam}`)} className="lg:col-span-5">
                <div className="h-[280px] flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={providerDonutData}
                        cx="50%" cy="50%"
                        innerRadius={65} outerRadius={105}
                        dataKey="value"
                        stroke="none"
                      >
                        {providerDonutData.map((_, i) => (
                          <Cell key={i} fill={VIBRANT_COLORS[i % VIBRANT_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="rounded-lg border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] px-3 py-2 text-xs text-[hsl(var(--dash-text))]">
                              <p className="font-semibold">{payload[0].name}</p>
                              <p>{payload[0].value} viabilidades</p>
                            </div>
                          ) : null
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[hsl(var(--dash-text))]">{providerTotal}</p>
                      <p className="text-[10px] text-[hsl(var(--dash-text-muted))]">total</p>
                    </div>
                  </div>
                </div>
              </DashChartCard>

              <DashChartCard title="Ranking de Solicitantes" onClick={() => navigate(`/dashboard/solicitantes?${periodParam}`)} className="lg:col-span-7">
                <ChartContainer config={solConfig} className="h-[280px] w-full">
                  <BarChart data={solicitantesData} layout="vertical">
                    <defs>
                      <linearGradient id="gradPurple" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(265, 85%, 60%)" />
                        <stop offset="100%" stopColor="hsl(320, 85%, 55%)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 40%, 20%)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                    <ChartTooltip cursor={CURSOR_STYLE} content={<ChartTooltipContent className={DARK_TOOLTIP_CLS} />} />
                    <Bar dataKey="total" fill="url(#gradPurple)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </DashChartCard>
            </div>

            {/* Row: Cidades + Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <DashChartCard title="Cidades Mais Consultadas" onClick={() => navigate(`/dashboard/regioes?${periodParam}`)} className="lg:col-span-6">
                <ChartContainer config={cidConfig} className="h-[280px] w-full">
                  <BarChart data={cidadesData}>
                    <defs>
                      <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(160, 70%, 45%)" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="hsl(185, 90%, 50%)" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 40%, 20%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(215, 20%, 55%)" }} interval={0} angle={-25} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                    <ChartTooltip content={<ChartTooltipContent className={DARK_TOOLTIP_CLS} />} />
                    <Bar dataKey="total" fill="url(#gradGreen)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </DashChartCard>

              <HeatmapPanel items={items || []} onClick={() => navigate(`/dashboard/regioes?${periodParam}`)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
