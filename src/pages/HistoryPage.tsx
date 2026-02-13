import { useFeasibilityHistory } from "@/hooks/useFeasibility";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle } from "lucide-react";

export default function HistoryPage() {
  const { data: queries, isLoading } = useFeasibilityHistory();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Histórico de Consultas</h1>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Provedor</TableHead>
                <TableHead>Distância</TableHead>
                <TableHead>Valor Final</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries?.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(q.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">{q.customer_address}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {q.providers && (
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: q.providers.color }} />
                      )}
                      {q.providers?.name || "—"}
                    </span>
                  </TableCell>
                  <TableCell>{q.calculated_distance_m ? `${q.calculated_distance_m}m` : "—"}</TableCell>
                  <TableCell>{q.final_value ? `R$ ${q.final_value.toFixed(2)}` : "—"}</TableCell>
                  <TableCell>
                    {q.is_viable !== null && (
                      <Badge variant={q.is_viable ? "default" : "destructive"} className="gap-1">
                        {q.is_viable ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {q.is_viable ? "Viável" : "Inviável"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!queries?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma consulta realizada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
