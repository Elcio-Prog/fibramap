import { useState } from "react";
import { useApiLogs, ApiLog } from "@/hooks/useApiLogs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Eye, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";

export default function ApiLogsTab() {
  const [filter, setFilter] = useState<string>("all");
  const { data: logs = [], isLoading, refetch, isFetching } = useApiLogs(filter === "all" ? undefined : filter);
  const [detail, setDetail] = useState<ApiLog | null>(null);

  const integrations = [...new Set(logs.map((l) => l.integration_name))];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Logs de Requisições API</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Filtrar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {integrations.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {log.response_ok ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{log.method}</Badge>
                        <span className="font-mono text-xs truncate">{log.endpoint}</span>
                        <Badge variant="outline" className="text-xs">{log.integration_name}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{format(new Date(log.created_at), "dd/MM HH:mm:ss")}</span>
                        {log.response_status && (
                          <span className={log.response_ok ? "text-green-600" : "text-destructive"}>
                            Status {log.response_status}
                          </span>
                        )}
                        {log.duration_ms != null && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {log.duration_ms}ms
                          </span>
                        )}
                        {log.error_message && (
                          <span className="text-destructive truncate max-w-[200px]">{log.error_message}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setDetail(log)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {detail?.method} /{detail?.endpoint}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">Integração</span>
                  <p className="font-medium">{detail.integration_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data</span>
                  <p className="font-medium">{format(new Date(detail.created_at), "dd/MM/yyyy HH:mm:ss")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium">{detail.response_status ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duração</span>
                  <p className="font-medium">{detail.duration_ms != null ? `${detail.duration_ms}ms` : "—"}</p>
                </div>
              </div>
              {detail.request_params && (
                <div>
                  <span className="text-muted-foreground text-xs">Parâmetros</span>
                  <pre className="bg-muted rounded p-3 text-xs overflow-x-auto mt-1">
                    {JSON.stringify(detail.request_params, null, 2)}
                  </pre>
                </div>
              )}
              {detail.response_body && (
                <div>
                  <span className="text-muted-foreground text-xs">Resposta (resumo)</span>
                  <pre className="bg-muted rounded p-3 text-xs overflow-x-auto mt-1 max-h-[300px]">
                    {JSON.stringify(detail.response_body, null, 2)}
                  </pre>
                </div>
              )}
              {detail.error_message && (
                <div>
                  <span className="text-muted-foreground text-xs">Erro</span>
                  <p className="text-destructive text-xs mt-1">{detail.error_message}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
