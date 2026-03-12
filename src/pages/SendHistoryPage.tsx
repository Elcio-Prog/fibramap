import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { History, ChevronDown, ChevronRight, Loader2, Copy, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ScrollableTable from "@/components/ui/scrollable-table";

const PAGE_SIZE = 20;

function BatchItems({ log }: { log: any }) {
  const { toast } = useToast();

  const { data: items, isLoading } = useQuery({
    queryKey: ["batch-items", log.id_lote],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ws_feasibility_items")
        .select("*")
        .eq("id_lote" as any, log.id_lote)
        .order("row_number", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!log.id_lote,
  });

  const copyDesignacao = (val: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: "Copiado!", description: val });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        {log.id_lote ? "Nenhum item encontrado para este lote." : "Lote anterior à rastreabilidade por itens."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {items.length} registro{items.length !== 1 ? "s" : ""} enviado{items.length !== 1 ? "s" : ""} neste lote.
      </p>

      {log.status === "erro" && log.mensagem_erro && (
        <div className="text-xs text-destructive bg-destructive/10 rounded p-2 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span><strong>Erro:</strong> {log.mensagem_erro}</span>
        </div>
      )}

      <ScrollableTable totalScrollableColumns={15}>
        <table className="text-xs w-max min-w-full">
          <thead className="sticky top-0 bg-muted z-10">
            <tr>
              <th className="px-2 py-1.5 text-left min-w-[100px] sticky left-0 z-20 bg-muted">Designação</th>
              <th className="px-2 py-1.5 text-left min-w-[100px]">Cliente</th>
              <th className="px-2 py-1.5 text-left">Coordenadas</th>
              <th className="px-2 py-1.5 text-left">Status</th>
              <th className="px-2 py-1.5 text-left">Produto</th>
              <th className="px-2 py-1.5 text-left">Tecnologia</th>
              <th className="px-2 py-1.5 text-left">Meio Físico</th>
              <th className="px-2 py-1.5 text-left">Vel.</th>
              <th className="px-2 py-1.5 text-left">Vigência</th>
              <th className="px-2 py-1.5 text-left">Taxa Inst.</th>
              <th className="px-2 py-1.5 text-left">Vlr Venda</th>
              <th className="px-2 py-1.5 text-left">CNPJ</th>
              <th className="px-2 py-1.5 text-left">Bloco IP</th>
              <th className="px-2 py-1.5 text-left">Tipo Sol.</th>
              <th className="px-2 py-1.5 text-left">Cód. Smark</th>
              <th className="px-2 py-1.5 text-left">Origem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => {
              const coords = item.lat_a != null && item.lng_a != null ? `${item.lat_a},${item.lng_a}` : "—";
              return (
                <tr key={item.id} className="border-t hover:bg-muted/30">
                  <td className="px-2 py-1 max-w-[100px] font-medium sticky left-0 z-10 bg-background">
                    {item.designacao ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="truncate block max-w-[100px] text-left hover:text-primary cursor-pointer"
                            onClick={() => copyDesignacao(item.designacao)}
                          >
                            <span className="flex items-center gap-1">
                              {item.designacao}
                              <Copy className="h-2.5 w-2.5 shrink-0 opacity-40" />
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Clique para copiar</TooltipContent>
                      </Tooltip>
                    ) : "—"}
                  </td>
                  <td className="px-2 py-1 max-w-[100px] truncate">{item.cliente || "—"}</td>
                  <td className="px-2 py-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="max-w-[80px] truncate block">{coords}</span>
                      </TooltipTrigger>
                      {coords !== "—" && <TooltipContent>{coords}</TooltipContent>}
                    </Tooltip>
                  </td>
                  <td className="px-2 py-1">
                    <Badge variant={item.is_viable ? "default" : "outline"} className="text-[10px]">
                      {item.is_viable ? "Viável" : item.is_viable === false ? "Inviável" : "—"}
                    </Badge>
                  </td>
                  <td className="px-2 py-1">{item.produto || "—"}</td>
                  <td className="px-2 py-1">{item.tecnologia || "—"}</td>
                  <td className="px-2 py-1">{item.tecnologia_meio_fisico || "—"}</td>
                  <td className="px-2 py-1">{item.velocidade_mbps != null ? `${item.velocidade_mbps} Mbps` : "—"}</td>
                  <td className="px-2 py-1">{item.vigencia || "—"}</td>
                  <td className="px-2 py-1">{item.taxa_instalacao != null ? item.taxa_instalacao : "—"}</td>
                  <td className="px-2 py-1">{item.valor_a_ser_vendido != null ? item.valor_a_ser_vendido : "—"}</td>
                  <td className="px-2 py-1">{item.cnpj_cliente || "—"}</td>
                  <td className="px-2 py-1">{item.bloco_ip || "—"}</td>
                  <td className="px-2 py-1">{item.tipo_solicitacao || "—"}</td>
                  <td className="px-2 py-1">{item.codigo_smark || "—"}</td>
                  <td className="px-2 py-1 max-w-[100px] truncate">
                    {/* Fetch batch title from the batch */}
                    —
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollableTable>
    </div>
  );
}

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
                <div className="flex items-center gap-3 flex-1 flex-wrap">
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
                {expandedId === log.id ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 pt-3 border-t">
                <div className="space-y-2 mb-2">
                  <p className="text-xs text-muted-foreground"><strong>ID do Lote:</strong> {log.id_lote}</p>
                </div>
                <BatchItems log={log} />
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
