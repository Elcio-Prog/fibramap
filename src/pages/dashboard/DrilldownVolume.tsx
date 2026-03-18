import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";

const DARK_TOOLTIP_CLS = "!bg-[hsl(215,45%,13%)] !border-[hsl(215,40%,20%)] !text-[hsl(210,20%,92%)] [&_.text-muted-foreground]:!text-[hsl(215,20%,55%)] [&_.text-foreground]:!text-[hsl(210,20%,92%)] [&_.font-medium]:!text-[hsl(210,20%,92%)]";
import { useDrilldownItems, PeriodFilter, getDateRange } from "@/hooks/useDashboardData";
import { format, startOfDay, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DrilldownVolume() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const period = (searchParams.get("period") || "30d") as PeriodFilter;
  const customFrom = searchParams.get("from") || "";
  const customTo = searchParams.get("to") || "";
  const customRange = period === "custom" && customFrom && customTo
    ? { from: new Date(customFrom), to: new Date(customTo + "T23:59:59") } : undefined;
  const range = getDateRange(period, customRange);
  const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");
  const { data: items, isLoading } = useDrilldownItems(period, customRange);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(today, { locale: ptBR }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const getItemDate = (i: any) => i.data_envio || i.created_at;
  const todayCount = items?.filter(i => format(new Date(getItemDate(i)), "yyyy-MM-dd") === todayStr).length ?? 0;
  const weekCount = items?.filter(i => format(new Date(getItemDate(i)), "yyyy-MM-dd") >= weekStart).length ?? 0;
  const monthCount = items?.filter(i => format(new Date(getItemDate(i)), "yyyy-MM-dd") >= monthStart).length ?? 0;

  const chartData = (() => {
    if (!items?.length) return [];
    if (view === "daily") {
      const days = eachDayOfInterval({ start: range.from, end: range.to });
      const countMap: Record<string, number> = {};
      items.forEach(i => { const key = format(new Date(getItemDate(i)), "yyyy-MM-dd"); countMap[key] = (countMap[key] || 0) + 1; });
      return days.map(d => ({ label: format(d, "dd/MM"), total: countMap[format(d, "yyyy-MM-dd")] || 0 }));
    } else if (view === "weekly") {
      const weeks = eachWeekOfInterval({ start: range.from, end: range.to }, { locale: ptBR });
      const countMap: Record<string, number> = {};
      items.forEach(i => { const key = format(startOfWeek(new Date(getItemDate(i)), { locale: ptBR }), "yyyy-MM-dd"); countMap[key] = (countMap[key] || 0) + 1; });
      return weeks.map(w => ({ label: `Sem ${format(w, "dd/MM")}`, total: countMap[format(w, "yyyy-MM-dd")] || 0 }));
    } else {
      const months = eachMonthOfInterval({ start: range.from, end: range.to });
      const countMap: Record<string, number> = {};
      items.forEach(i => { const key = format(startOfMonth(new Date(getItemDate(i))), "yyyy-MM"); countMap[key] = (countMap[key] || 0) + 1; });
      return months.map(m => ({ label: format(m, "MMM/yy", { locale: ptBR }), total: countMap[format(m, "yyyy-MM")] || 0 }));
    }
  })();

  const chartConfig = { total: { label: "Viabilidades", color: "hsl(210, 100%, 55%)" } };

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(var(--dash-bg))" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-[hsl(var(--dash-text))] hover:bg-[hsl(var(--dash-card))]"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold text-[hsl(var(--dash-text))]">Volume de Viabilidades</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--dash-text-muted))]" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[{ label: "Hoje", val: todayCount }, { label: "Esta semana", val: weekCount }, { label: "Este mês", val: monthCount }].map(c => (
                <div key={c.label} className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4 text-center">
                  <p className="text-sm text-[hsl(var(--dash-text-muted))]">{c.label}</p>
                  <p className="text-2xl font-bold text-[hsl(var(--dash-text))]">{c.val}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))]">Evolução de envios</h3>
                <Tabs value={view} onValueChange={(v) => setView(v as any)}>
                  <TabsList className="h-8 bg-[hsl(var(--dash-bg))]">
                    <TabsTrigger value="daily" className="text-xs data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-white">Diário</TabsTrigger>
                    <TabsTrigger value="weekly" className="text-xs data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-white">Semanal</TabsTrigger>
                    <TabsTrigger value="monthly" className="text-xs data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-white">Mensal</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                {view === "daily" ? (
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(210, 100%, 55%)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(185, 90%, 50%)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 40%, 20%)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                    <ChartTooltip content={<ChartTooltipContent className={DARK_TOOLTIP_CLS} />} />
                    <Area type="monotone" dataKey="total" stroke="hsl(210, 100%, 55%)" strokeWidth={2} fill="url(#gradBlue)" />
                  </AreaChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 40%, 20%)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                    <ChartTooltip content={<ChartTooltipContent className={DARK_TOOLTIP_CLS} />} />
                    <Bar dataKey="total" fill="hsl(210, 100%, 55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ChartContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
