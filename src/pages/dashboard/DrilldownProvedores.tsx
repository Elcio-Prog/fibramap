import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useDrilldownItems, PeriodFilter } from "@/hooks/useDashboardData";

const VIBRANT_COLORS = [
  "hsl(210, 100%, 55%)", "hsl(185, 90%, 50%)", "hsl(265, 85%, 60%)",
  "hsl(320, 85%, 55%)", "hsl(160, 70%, 45%)", "hsl(25, 95%, 55%)",
];

export default function DrilldownProvedores() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const period = (searchParams.get("period") || "30d") as PeriodFilter;
  const customFrom = searchParams.get("from") || "";
  const customTo = searchParams.get("to") || "";
  const customRange = period === "custom" && customFrom && customTo
    ? { from: new Date(customFrom), to: new Date(customTo + "T23:59:59") } : undefined;

  const { data: items, isLoading } = useDrilldownItems(period, customRange);

  const providerCounts: Record<string, number> = {};
  (items || []).forEach((i: any) => { const p = i.result_provider || "Sem provedor"; providerCounts[p] = (providerCounts[p] || 0) + 1; });
  const sorted = Object.entries(providerCounts).sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((s, [, c]) => s + c, 0);
  const chartData = sorted.slice(0, 10).map(([name, count]) => ({ name, total: count }));
  const chartConfig = { total: { label: "Viabilidades", color: "hsl(185, 90%, 50%)" } };

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(var(--dash-bg))" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-[hsl(var(--dash-text))] hover:bg-[hsl(var(--dash-card))]"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold text-[hsl(var(--dash-text))]">Provedores</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--dash-text-muted))]" /></div>
        ) : (
          <>
            <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3">Volume por Provedor</h3>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={chartData}>
                  <defs>
                    <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(185, 90%, 50%)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(210, 100%, 55%)" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 40%, 20%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="url(#gradCyan)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>

            <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3">Detalhamento</h3>
              <Table>
                <TableHeader>
                  <TableRow className="border-[hsl(var(--dash-border))]">
                    <TableHead className="text-[hsl(var(--dash-text-muted))]">Provedor</TableHead>
                    <TableHead className="text-[hsl(var(--dash-text-muted))] text-right">Total</TableHead>
                    <TableHead className="text-[hsl(var(--dash-text-muted))] text-right">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(([name, count]) => (
                    <TableRow key={name} className="border-[hsl(var(--dash-border))]">
                      <TableCell className="text-[hsl(var(--dash-text))] font-medium">{name}</TableCell>
                      <TableCell className="text-right text-[hsl(var(--dash-text))]">{count}</TableCell>
                      <TableCell className="text-right text-[hsl(var(--dash-text-muted))]">{((count / grandTotal) * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                  {sorted.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-[hsl(var(--dash-text-muted))]">Nenhum dado encontrado.</TableCell></TableRow>
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
