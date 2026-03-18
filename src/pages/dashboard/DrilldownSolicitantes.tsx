import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const DARK_TOOLTIP_CLS = "!bg-[hsl(215,45%,13%)] !border-[hsl(215,40%,20%)] !text-[hsl(210,20%,92%)] [&_.text-muted-foreground]:!text-[hsl(215,20%,55%)]";
import { useDrilldownLogs, PeriodFilter } from "@/hooks/useDashboardData";

export default function DrilldownSolicitantes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const period = (searchParams.get("period") || "30d") as PeriodFilter;
  const customFrom = searchParams.get("from") || "";
  const customTo = searchParams.get("to") || "";
  const customRange = period === "custom" && customFrom && customTo
    ? { from: new Date(customFrom), to: new Date(customTo + "T23:59:59") } : undefined;

  const { data: logs, isLoading } = useDrilldownLogs(period, customRange);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  const emailCounts: Record<string, number> = {};
  (logs || []).forEach((l: any) => { emailCounts[l.usuario_email] = (emailCounts[l.usuario_email] || 0) + l.quantidade_itens; });
  const sorted = Object.entries(emailCounts).sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((s, [, c]) => s + c, 0);
  const top10 = sorted.slice(0, 10);
  const chartData = top10.map(([email, count]) => ({ name: email.split("@")[0], total: count }));
  const chartConfig = { total: { label: "Viabilidades", color: "hsl(265, 85%, 60%)" } };

  const filteredLogs = selectedEmail ? (logs || []).filter((l: any) => l.usuario_email === selectedEmail) : null;

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(var(--dash-bg))" }}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-[hsl(var(--dash-text))] hover:bg-[hsl(var(--dash-card))]"><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold text-[hsl(var(--dash-text))]">Ranking de Solicitantes</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--dash-text-muted))]" /></div>
        ) : (
          <>
            <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3">Top 10 Solicitantes</h3>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={chartData} layout="vertical">
                  <defs>
                    <linearGradient id="gradPurple" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(265, 85%, 60%)" />
                      <stop offset="100%" stopColor="hsl(320, 85%, 55%)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 40%, 20%)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="url(#gradPurple)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </div>

            <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3">
                {selectedEmail ? (
                  <span className="flex items-center gap-2">Filtrado: {selectedEmail}
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-[hsl(var(--dash-text-muted))]" onClick={() => setSelectedEmail(null)}>Limpar</Button>
                  </span>
                ) : "Todos os solicitantes"}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow className="border-[hsl(var(--dash-border))]">
                    <TableHead className="text-[hsl(var(--dash-text-muted))] w-12">#</TableHead>
                    <TableHead className="text-[hsl(var(--dash-text-muted))]">Solicitante</TableHead>
                    <TableHead className="text-[hsl(var(--dash-text-muted))] text-right">Total</TableHead>
                    <TableHead className="text-[hsl(var(--dash-text-muted))] text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(([email, count], i) => (
                    <TableRow key={email} className="cursor-pointer border-[hsl(var(--dash-border))] hover:bg-[hsl(var(--dash-card-hover))]" onClick={() => setSelectedEmail(email === selectedEmail ? null : email)}>
                      <TableCell className="text-[hsl(var(--dash-text))]">{i + 1}</TableCell>
                      <TableCell className="text-[hsl(var(--dash-text))]">{email}</TableCell>
                      <TableCell className="text-right text-[hsl(var(--dash-text))] font-medium">{count}</TableCell>
                      <TableCell className="text-right text-[hsl(var(--dash-text-muted))]">{((count / grandTotal) * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredLogs && filteredLogs.length > 0 && (
              <div className="rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-card))] p-4">
                <h3 className="text-sm font-semibold text-[hsl(var(--dash-text))] mb-3">Envios de {selectedEmail}</h3>
                <Table>
                  <TableHeader>
                    <TableRow className="border-[hsl(var(--dash-border))]">
                      <TableHead className="text-[hsl(var(--dash-text-muted))]">Data</TableHead>
                      <TableHead className="text-[hsl(var(--dash-text-muted))] text-right">Itens</TableHead>
                      <TableHead className="text-[hsl(var(--dash-text-muted))]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((l: any) => (
                      <TableRow key={l.id} className="border-[hsl(var(--dash-border))]">
                        <TableCell className="text-[hsl(var(--dash-text))]">{new Date(l.data_envio).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right text-[hsl(var(--dash-text))]">{l.quantidade_itens}</TableCell>
                        <TableCell className="text-[hsl(var(--dash-text))]">{l.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
