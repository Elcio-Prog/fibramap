import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
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

  const chartConfig = { total: { label: "Total", color: "hsl(var(--primary))" } };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold">Comparativo Mensal</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Últimos 6 meses</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Tabela Comparativa</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Total Enviado</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                    <TableHead className="text-right">Média Diária</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map(row => (
                    <TableRow key={row.month} className={row.isBest ? "bg-accent/10" : row.isWorst ? "bg-destructive/10" : ""}>
                      <TableCell className="font-medium">
                        {row.label}
                        {row.isBest && <span className="ml-2 text-xs text-accent">⬆ Melhor</span>}
                        {row.isWorst && <span className="ml-2 text-xs text-destructive">⬇ Pior</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium">{row.total}</TableCell>
                      <TableCell className="text-right">
                        {row.variation !== null ? (
                          <span className={`inline-flex items-center gap-0.5 text-xs ${row.variation >= 0 ? "text-accent" : "text-destructive"}`}>
                            {row.variation >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {row.variation >= 0 ? "+" : ""}{row.variation.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">{row.avgDaily}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
