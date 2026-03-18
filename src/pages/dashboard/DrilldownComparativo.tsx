import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const DARK_TOOLTIP_CLS = "!bg-[hsl(215,45%,13%)] !border-[hsl(215,40%,20%)] !text-[hsl(210,20%,92%)] [&_.text-muted-foreground]:!text-[hsl(215,20%,55%)]";
import { useComparativoData } from "@/hooks/useDashboardData";
import { format, parse, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DrilldownComparativo() {
  const navigate = useNavigate();
  const { data: monthlyData, isLoading } = useComparativoData();

  const chartData = (monthlyData || []).map(m => ({
    label: format(parse(m.month, "yyyy-MM", new Date()), "MMM/yy", { locale: ptBR }),
    total: m.total,
    month: m.month,
  }));

  const maxMonth = chartData.reduce((max, c) => c.total > max.total ? c : max, chartData[0] || { total: 0, month: "" });
  const minMonth = chartData.reduce((min, c) => c.total < min.total ? c : min, chartData[0] || { total: Infinity, month: "" });

  const tableData = chartData.map((c, i) => {
    const prev = i > 0 ? chartData[i - 1].total : null;
    const variation = prev !== null && prev > 0 ? ((c.total - prev) / prev) * 100 : null;
    const daysInMonth = getDaysInMonth(parse(c.month, "yyyy-MM", new Date()));
    const avgDaily = (c.total / daysInMonth).toFixed(1);
    return { ...c, variation, avgDaily, isBest: c.month === maxMonth?.month, isWorst: c.month === minMonth?.month };
  });

  const chartConfig = { total: { label: "Total", color: "hsl(185, 90%, 50%)" } };

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(var(--dash-bg))" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-[hsl(var(--dash-text))] hover:bg-[hsl(var(--dash-card))]"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold text-[hsl(var(--dash-text))]">Comparativo Mensal</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--dash-text-muted))]" /></div>
        ) : (
          <>
            <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3">Últimos 6 meses</h3>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={chartData}>
                  <defs>
                    <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(185, 90%, 50%)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(210, 100%, 55%)" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 40%, 20%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(215, 20%, 55%)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                  <ChartTooltip content={<ChartTooltipContent className={DARK_TOOLTIP_CLS} />} />
                  <Bar dataKey="total" fill="url(#gradCyan)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>

            <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3">Tabela Comparativa</h3>
              <Table>
                <TableHeader>
                  <TableRow className="border-[hsl(var(--dash-border))]">
                    <TableHead className="text-[hsl(var(--dash-text-muted))]">Mês</TableHead>
                    <TableHead className="text-[hsl(var(--dash-text-muted))] text-right">Total</TableHead>
                    <TableHead className="text-[hsl(var(--dash-text-muted))] text-right">Variação</TableHead>
                    <TableHead className="text-[hsl(var(--dash-text-muted))] text-right">Média Diária</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map(row => (
                    <TableRow key={row.month} className={`border-[hsl(var(--dash-border))] ${row.isBest ? "bg-emerald-500/10" : row.isWorst ? "bg-red-500/10" : ""}`}>
                      <TableCell className="text-[hsl(var(--dash-text))] font-medium">
                        {row.label}
                        {row.isBest && <span className="ml-2 text-xs text-emerald-400">⬆ Melhor</span>}
                        {row.isWorst && <span className="ml-2 text-xs text-red-400">⬇ Pior</span>}
                      </TableCell>
                      <TableCell className="text-right text-[hsl(var(--dash-text))] font-medium">{row.total}</TableCell>
                      <TableCell className="text-right">
                        {row.variation !== null ? (
                          <span className={`inline-flex items-center gap-0.5 text-xs ${row.variation >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {row.variation >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {row.variation >= 0 ? "+" : ""}{row.variation.toFixed(1)}%
                          </span>
                        ) : <span className="text-[hsl(var(--dash-text-muted))]">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-[hsl(var(--dash-text))]">{row.avgDaily}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
