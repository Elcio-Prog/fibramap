import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { History, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

const PAGE_SIZE = 20;

export default function SendHistoryPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["logs-envio", user?.id, isAdmin, statusFilter, dateFrom, dateTo, emailFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("logs_envio_sharepoint" as any)
        .select("*", { count: "exact" })
        .order("data_envio", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (dateFrom) query = query.gte("data_envio", dateFrom);
      if (dateTo) query = query.lte("data_envio", dateTo + "T23:59:59Z");
      if (emailFilter.trim() && isAdmin) query = query.ilike("usuario_email", `%${emailFilter.trim()}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data as any[], total: count || 0 };
    },
    enabled: !!user?.id,
  });

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <History className="h-6 w-6" /> Histórico de Envios
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sucesso">Sucesso</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="h-8 w-[150px] text-xs"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          placeholder="Data início"
        />
        <Input
          type="date"
          className="h-8 w-[150px] text-xs"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          placeholder="Data fim"
        />
        {isAdmin && (
          <Input
            className="h-8 w-[200px] text-xs"
            placeholder="Filtrar por email..."
            value={emailFilter}
            onChange={(e) => { setEmailFilter(e.target.value); setPage(0); }}
          />
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (!data?.logs || data.logs.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum envio encontrado.
          </CardContent>
        </Card>
      )}

      {data?.logs?.map((log: any) => (
        <Collapsible key={log.id} open={expandedId === log.id} onOpenChange={(open) => setExpandedId(open ? log.id : null)}>
          <Card>
            <CardContent className="py-3">
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                <div className="flex items-center gap-3 flex-1">
                  <Badge variant={log.status === "sucesso" ? "default" : "destructive"} className="text-xs">
                    {log.status === "sucesso" ? "Sucesso" : "Erro"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.data_envio).toLocaleString("pt-BR")}
                  </span>
                  <span className="text-xs">{log.usuario_email}</span>
                  <Badge variant="outline" className="text-xs">{log.quantidade_itens} itens</Badge>
                  {log.response_code && (
                    <span className="text-xs text-muted-foreground">HTTP {log.response_code}</span>
                  )}
                </div>
                {expandedId === log.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 pt-3 border-t space-y-1">
                <p className="text-xs"><strong>ID do Lote:</strong> {log.id_lote}</p>
                {log.mensagem_erro && (
                  <p className="text-xs text-destructive"><strong>Erro:</strong> {log.mensagem_erro}</p>
                )}
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
