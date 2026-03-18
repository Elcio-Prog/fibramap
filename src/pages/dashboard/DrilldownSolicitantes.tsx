import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
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
  (logs || []).forEach((l: any) => {
    emailCounts[l.usuario_email] = (emailCounts[l.usuario_email] || 0) + l.quantidade_itens;
  });
  const sorted = Object.entries(emailCounts).sort((a, b) => b[1] - a[1]);
  const grandTotal = sorted.reduce((s, [, c]) => s + c, 0);
  const top10 = sorted.slice(0, 10);

  const chartData = top10.map(([email, count]) => ({
    name: email.split("@")[0],
    total: count,
  }));

  const chartConfig = { total: { label: "Viabilidades", color: "hsl(var(--primary))" } };

  const filteredLogs = selectedEmail
    ? (logs || []).filter((l: any) => l.usuario_email === selectedEmail)
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold">Ranking de Solicitantes</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Top 10 Solicitantes</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selectedEmail ? (
                  <span className="flex items-center gap-2">
                    Filtrado: {selectedEmail}
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedEmail(null)}>Limpar</Button>
                  </span>
                ) : "Todos os solicitantes"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead className="text-right">Total Enviado</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(([email, count], i) => (
                    <TableRow
                      key={email}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedEmail(email === selectedEmail ? null : email)}
                      data-state={email === selectedEmail ? "selected" : undefined}
                    >
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>{email}</TableCell>
                      <TableCell className="text-right font-medium">{count}</TableCell>
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

          {filteredLogs && filteredLogs.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Envios de {selectedEmail}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell>{new Date(l.data_envio).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right">{l.quantidade_itens}</TableCell>
                        <TableCell>{l.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
