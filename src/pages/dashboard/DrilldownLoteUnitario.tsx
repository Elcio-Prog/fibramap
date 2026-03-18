import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const DARK_TOOLTIP_CLS = "!bg-[hsl(215,45%,13%)] !border-[hsl(215,40%,20%)] !text-[hsl(210,20%,92%)] [&_.text-muted-foreground]:!text-[hsl(215,20%,55%)]";
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

  const pieData = [{ name: "Lote", value: loteTotal }, { name: "Unitário", value: unitarioTotal }];
  const COLORS = ["hsl(265, 85%, 60%)", "hsl(320, 85%, 55%)"];

  const days = eachDayOfInterval({ start: range.from, end: range.to });
  const evolutionData = days.slice(-60).map(d => {
    const dayStr = format(d, "yyyy-MM-dd");
    const dayLogs = (logs || []).filter((l: any) => format(new Date(l.data_envio), "yyyy-MM-dd") === dayStr);
    const lote = dayLogs.filter((l: any) => l.quantidade_itens > 1).reduce((s: number, l: any) => s + l.quantidade_itens, 0);
    const unit = dayLogs.filter((l: any) => l.quantidade_itens === 1).length;
    const total = lote + unit;
    return { label: format(d, "dd/MM"), lotePct: total > 0 ? (lote / total) * 100 : 0 };
  });

  const chartConfig = { lotePct: { label: "% Lote", color: "hsl(265, 85%, 60%)" } };

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(var(--dash-bg))" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-[hsl(var(--dash-text))] hover:bg-[hsl(var(--dash-card))]"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold text-[hsl(var(--dash-text))]">Lote vs. Busca Unitária</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--dash-text-muted))]" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[{ label: "Total em Lote", val: loteTotal }, { label: "Total Unitário", val: unitarioTotal }, { label: "Tamanho médio lote", val: avgLoteSize }].map(c => (
                <div key={c.label} className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4 text-center">
                  <p className="text-sm text-[hsl(var(--dash-text-muted))]">{c.label}</p>
                  <p className="text-2xl font-bold text-[hsl(var(--dash-text))]">{c.val}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
                <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3">Proporção</h3>
                <div className="flex justify-center">
                  <ChartContainer config={chartConfig} className="h-[280px] w-[280px]">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent className={DARK_TOOLTIP_CLS} />} />
                    </PieChart>
                  </ChartContainer>
                </div>
              </div>

              <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
                <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3">Evolução % Lote</h3>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 40%, 20%)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} unit="%" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="lotePct" stroke="hsl(265, 85%, 60%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
