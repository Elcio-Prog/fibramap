import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { fmId } from "@/lib/utils";

interface VarianciaRow {
  id: string;
  numero: number;
  endereco: string | null;
  nome_cliente: string | null;
  distancia_sistema: number | null;
  distancia_projetista: number | null;
  variancia_distancia: number | null;
  created_at: string | null;
}

function VarianciaBadge({ sistema, projetista }: { sistema: number; projetista: number }) {
  if (sistema === 0) return <Badge variant="outline" className="text-[10px]">N/A</Badge>;
  const pct = ((projetista - sistema) / sistema) * 100;
  const abs = Math.abs(pct);
  const label = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  if (abs <= 10) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]" variant="outline">{label}</Badge>;
  if (abs <= 30) return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]" variant="outline">{label}</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]" variant="outline">{label}</Badge>;
}

export default function VarianciaDistanciasTab() {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["variancia-distancias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pre_viabilidades" as any)
        .select("id, numero, endereco, nome_cliente, distancia_sistema, distancia_projetista, variancia_distancia, viabilidade, created_at")
        .not("distancia_projetista", "is", null)
        .not("distancia_sistema", "is", null)
        .neq("variancia_distancia", 0)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as VarianciaRow[];
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-3">
          Análise de Variância de Distâncias
          {rows && rows.length > 0 && (() => {
            const valid = rows.filter(r => r.distancia_sistema != null && r.distancia_projetista != null && r.distancia_sistema !== 0);
            if (valid.length === 0) return null;
            const avg = valid.reduce((sum, r) => sum + ((r.distancia_projetista! - r.distancia_sistema!) / r.distancia_sistema!) * 100, 0) / valid.length;
            const abs = Math.abs(avg);
            const color = abs <= 10 ? "bg-emerald-100 text-emerald-800 border-emerald-200" : abs <= 30 ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-red-100 text-red-800 border-red-200";
            return <Badge variant="outline" className={`${color} text-[11px] ml-1`}>Média: {avg >= 0 ? "+" : ""}{avg.toFixed(1)}% ({valid.length} itens)</Badge>;
          })()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!rows || rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma viabilidade com distância de projetista preenchida.</p>
        ) : (
          <div className="overflow-auto border rounded-md">
            <table className="text-xs w-full min-w-[700px]">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left">#</th>
                  <th className="px-2 py-1.5 text-left">Endereço / Cliente</th>
                  <th className="px-2 py-1.5 text-right">Dist. Projetista (m)</th>
                  <th className="px-2 py-1.5 text-right">Dist. Sistema (m)</th>
                  <th className="px-2 py-1.5 text-right">Variância (m)</th>
                  <th className="px-2 py-1.5 text-center">Variância %</th>
                  <th className="px-2 py-1.5 text-left">Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-2 py-1 font-mono">{fmId(r.numero)}</td>
                    <td className="px-2 py-1 max-w-[200px] truncate">
                      {r.endereco || r.nome_cliente || "—"}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.distancia_projetista != null ? Math.round(r.distancia_projetista).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.distancia_sistema != null ? Math.round(r.distancia_sistema).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {r.variancia_distancia != null ? Math.round(r.variancia_distancia).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {r.distancia_sistema != null && r.distancia_projetista != null ? (
                        <VarianciaBadge sistema={r.distancia_sistema} projetista={r.distancia_projetista} />
                      ) : "—"}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
