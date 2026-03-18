import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer } from "recharts";
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
    ? { from: new Date(customFrom), to: new Date(customTo + "T23:59:59") }
    : undefined;
  const range = getDateRange(period, customRange);

  const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");
  const { data: items, isLoading } = useDrilldownItems(period, customRange);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(today, { locale: ptBR }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");

  const todayCount = items?.filter(i => format(new Date(i.data_envio!), "yyyy-MM-dd") === todayStr).length ?? 0;
  const weekCount = items?.filter(i => i.data_envio! >= weekStart).length ?? 0;
  const monthCount = items?.filter(i => i.data_envio! >= monthStart).length ?? 0;

  const chartData = (() => {
    if (!items?.length) return [];
    if (view === "daily") {
      const days = eachDayOfInterval({ start: range.from, end: range.to });
      const countMap: Record<string, number> = {};
      items.forEach(i => {
        const key = format(new Date(i.data_envio!), "yyyy-MM-dd");
        countMap[key] = (countMap[key] || 0) + 1;
      });
      return days.map(d => ({ label: format(d, "dd/MM"), total: countMap[format(d, "yyyy-MM-dd")] || 0 }));
    } else if (view === "weekly") {
      const weeks = eachWeekOfInterval({ start: range.from, end: range.to }, { locale: ptBR });
      const countMap: Record<string, number> = {};
      items.forEach(i => {
        const key = format(startOfWeek(new Date(i.data_envio!), { locale: ptBR }), "yyyy-MM-dd");
        countMap[key] = (countMap[key] || 0) + 1;
      });
      return weeks.map(w => ({ label: `Sem ${format(w, "dd/MM")}`, total: countMap[format(w, "yyyy-MM-dd")] || 0 }));
    } else {
      const months = eachMonthOfInterval({ start: range.from, end: range.to });
      const countMap: Record<string, number> = {};
      items.forEach(i => {
        const key = format(startOfMonth(new Date(i.data_envio!)), "yyyy-MM");
        countMap[key] = (countMap[key] || 0) + 1;
      });
      return months.map(m => ({ label: format(m, "MMM/yy", { locale: ptBR }), total: countMap[format(m, "yyyy-MM")] || 0 }));
    }
  })();

  const chartConfig = { total: { label: "Viabilidades", color: "hsl(var(--primary))" } };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Volume de Viabilidades</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Hoje</p><p className="text-2xl font-bold">{todayCount}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Esta semana</p><p className="text-2xl font-bold">{weekCount}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Este mês</p><p className="text-2xl font-bold">{monthCount}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Evolução de envios</CardTitle>
              <Tabs value={view} onValueChange={(v) => setView(v as any)}>
                <TabsList className="h-8"><TabsTrigger value="daily" className="text-xs">Diário</TabsTrigger><TabsTrigger value="weekly" className="text-xs">Semanal</TabsTrigger><TabsTrigger value="monthly" className="text-xs">Mensal</TabsTrigger></TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                {view === "daily" ? (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" className="text-[10px]" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                )}
              </ChartContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
