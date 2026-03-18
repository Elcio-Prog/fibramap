import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { useDrilldownLogs, PeriodFilter, getDateRange } from "@/hooks/useDashboardData";
import { format, eachDayOfInterval } from "date-fns";

export default function DrilldownLoteUnitario() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const period = (searchParams.get("period") || "30d") as PeriodFilter;
  const customFrom = searchParams.get("from") || "";
  const customTo = searchParams.get("to") || "";
  const customRange = period === "custom" && customFrom && customTo
    ? { from: new Date(customFrom), to: new Date(customTo + "T23:59:59") } : undefined;
  const range = getDateRange(period, customRange);

  const { data: logs, isLoading } = useDrilldownLogs(period, customRange);

  const loteLogs = (logs || []).filter((l: any) => l.quantidade_itens > 1);
  const unitarioLogs = (logs || []).filter((l: any) => l.quantidade_itens === 1);
  const loteTotal = loteLogs.reduce((s: number, l: any) => s + l.quantidade_itens, 0);
  const unitarioTotal = unitarioLogs.reduce((s: number, l: any) => s + l.quantidade_itens, 0);
  const avgLoteSize = loteLogs.length > 0 ? (loteTotal / loteLogs.length).toFixed(1) : "0";

  const pieData = [
    { name: "Lote", value: loteTotal },
    { name: "Unitário", value: unitarioTotal },
  ];
  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))"];

  // Evolution by day
  const days = eachDayOfInterval({ start: range.from, end: range.to });
  const evolutionData = days.map(d => {
    const dayStr = format(d, "yyyy-MM-dd");
    const dayLogs = (logs || []).filter((l: any) => format(new Date(l.data_envio), "yyyy-MM-dd") === dayStr);
    const lote = dayLogs.filter((l: any) => l.quantidade_itens > 1).reduce((s: number, l: any) => s + l.quantidade_itens, 0);
    const unit = dayLogs.filter((l: any) => l.quantidade_itens === 1).length;
    const total = lote + unit;
    return { label: format(d, "dd/MM"), lotePct: total > 0 ? (lote / total) * 100 : 0 };
  });

  const chartConfig = { lote: { label: "Lote", color: "hsl(var(--primary))" }, unitario: { label: "Unitário", color: "hsl(var(--accent))" }, lotePct: { label: "% Lote", color: "hsl(var(--primary))" } };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold">Lote vs. Busca Unitária</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total em Lote</p><p className="text-2xl font-bold">{loteTotal}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Unitário</p><p className="text-2xl font-bold">{unitarioTotal}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Tamanho médio dos lotes</p><p className="text-2xl font-bold">{avgLoteSize}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Proporção</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ChartContainer config={chartConfig} className="h-[280px] w-[280px]">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Evolução % Lote ao longo do tempo</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="lotePct" stroke="var(--color-lotePct)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
