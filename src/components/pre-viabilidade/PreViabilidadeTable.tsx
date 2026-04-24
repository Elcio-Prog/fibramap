import { useState, useMemo } from "react";
import { PreViabilidade, useDeletePreViabilidade, getRoiIndicators } from "@/hooks/usePreViabilidades";
import { useUserRole } from "@/hooks/useUserRole";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowUpDown, Pencil, Link2, Trash2, History, ShieldCheck } from "lucide-react";
import { cn, fmId } from "@/lib/utils";
import StatusBadge from "./StatusBadge";
import ScrollableTable from "@/components/ui/scrollable-table";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import VersionHistoryDialog from "./VersionHistoryDialog";
import SolicitarAprovacaoDialog from "./SolicitarAprovacaoDialog";

interface Props {
  data: PreViabilidade[];
  search: string;
  statusFilter: string;
  viabilidadeFilter: string;
  guardaChuvaFilter: string | null;
  onGuardaChuvaClick: (id: string | null) => void;
  onEdit: (item: PreViabilidade) => void;
}

type SortKey = keyof PreViabilidade;

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const PAGE_OPTIONS = [10, 25, 50];

export default function PreViabilidadeTable({ data, search, statusFilter, viabilidadeFilter, guardaChuvaFilter, onGuardaChuvaClick, onEdit }: Props) {
  const { isAdmin, isImplantacao, isBko } = useUserRole();
  const canEdit = isAdmin || isImplantacao || isBko;
  const canDelete = isAdmin || isImplantacao;
  const { toast } = useToast();
  const deleteMutation = useDeletePreViabilidade();
  const [sortKey, setSortKey] = useState<SortKey>("numero");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [contextRowId, setContextRowId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PreViabilidade | null>(null);
  const [historyTarget, setHistoryTarget] = useState<PreViabilidade | null>(null);
  const [aprovacaoTarget, setAprovacaoTarget] = useState<PreViabilidade | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast({ title: "Registro excluído com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  // Count how many records share the same id_guardachuva
  const guardaChuvaCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of data) {
      if (r.id_guardachuva) {
        map[r.id_guardachuva] = (map[r.id_guardachuva] || 0) + 1;
      }
    }
    return map;
  }, [data]);

  const filtered = useMemo(() => {
    let list = data;
    if (guardaChuvaFilter) list = list.filter((r) => r.id_guardachuva === guardaChuvaFilter);
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (viabilidadeFilter !== "all") {
      list = list.filter((r) => {
        const isSistema = r.viabilidade === "Viabilizado pelo Sistema";
        const derived = r.inviabilidade_tecnica
          ? "Inviabilidade Técnica"
          : (r.viabilidade === "Aguardando Projetista" && !r.distancia_projetista)
              ? "Aguardando Projetista"
              : (r.ticket_mensal != null && r.valor_minimo != null)
                  ? (r.ticket_mensal >= r.valor_minimo
                      ? (isSistema ? "Viabilizado pelo Sistema" : "Viável")
                      : (isSistema ? "Abaixo do Valor - Sistema" : "Abaixo do Valor"))
                  : r.viabilidade;
        return derived === viabilidadeFilter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.nome_cliente || "").toLowerCase().includes(q) ||
        (r.viabilidade || "").toLowerCase().includes(q) ||
        String(r.numero).includes(q) ||
        (r.id_guardachuva || "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return list;
  }, [data, guardaChuvaFilter, statusFilter, viabilidadeFilter, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortHeader = ({ field, children }: { field: SortKey; children: React.ReactNode }) => (
    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <span className="flex items-center gap-1">{children} <ArrowUpDown className="h-3 w-3" /></span>
    </th>
  );

  const Th = ({ children }: { children: React.ReactNode }) => (
    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{children}</th>
  );

  const TruncCell = ({ value, max = 120 }: { value: string | null | undefined; max?: number }) => {
    if (!value) return <span className="text-muted-foreground">—</span>;
    if (value.length <= max) return <span>{value}</span>;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="block truncate" style={{ maxWidth: max }}>{value}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-wrap">{value}</TooltipContent>
      </Tooltip>
    );
  };

  const GuardaChuvaCell = ({ value }: { value: string | null | undefined }) => {
    if (!value) return <span className="text-muted-foreground">—</span>;
    const count = guardaChuvaCountMap[value] || 0;
    return (
      <button
        className="flex items-center gap-1.5 hover:underline text-left"
        onClick={(e) => {
          e.stopPropagation();
          onGuardaChuvaClick(guardaChuvaFilter === value ? null : value);
        }}
      >
        <span className="truncate max-w-[80px]">{value}</span>
        {count > 1 && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] gap-0.5 font-semibold">
            <Link2 className="h-2.5 w-2.5" />
            {count}
          </Badge>
        )}
      </button>
    );
  };

  return (
    <div>
      <ScrollableTable totalScrollableColumns={25}>
        <table className="text-xs w-max min-w-full">
          <thead className="sticky top-0 bg-muted z-10">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap sticky left-0 z-20 bg-muted min-w-[50px] cursor-pointer select-none" onClick={() => toggleSort("numero" as SortKey)}>
                <span className="flex items-center gap-1">Nº <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <Th>Aprovação</Th>
              <SortHeader field="criado_por">Criado por</SortHeader>
              <SortHeader field="status">Status</SortHeader>
              <SortHeader field="tipo_solicitacao">Tipo Solicitação</SortHeader>
              <SortHeader field="produto_nt">Produto NT</SortHeader>
              <SortHeader field="vigencia">Vigência</SortHeader>
              <SortHeader field="valor_minimo">Valor Mínimo</SortHeader>
              <SortHeader field="viabilidade">Viabilidade</SortHeader>
              <SortHeader field="ticket_mensal">Ticket Mensal</SortHeader>
              <SortHeader field="status_aprovacao">Status Aprovação</SortHeader>
              <SortHeader field="aprovado_por">Aprovado por</SortHeader>
              <SortHeader field="nome_cliente">Nome Cliente</SortHeader>
              <Th>Previsão ROI</Th>
              <Th>ROI Global</Th>
              <SortHeader field="status_viabilidade">Status Viabilidade</SortHeader>
              <SortHeader field="projetista">Projetista</SortHeader>
              <SortHeader field="motivo_solicitacao">Motivo</SortHeader>
              <SortHeader field="observacoes">Observações</SortHeader>
              <SortHeader field="id_guardachuva">ID GuardaChuva</SortHeader>
              <SortHeader field="codigo_smark">Cód. SMARK</SortHeader>
              <Th>Inviab. Técnica</Th>
              <Th>Coment. Aprovador</Th>
              <Th>Obs. Validação</Th>
              <SortHeader field="created_at">Data Criação</SortHeader>
              <SortHeader field="modificado_por">Modificado por</SortHeader>
              <SortHeader field="updated_at">Modificado</SortHeader>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={26} className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <ContextMenu key={row.id} onOpenChange={(open) => setContextRowId(open ? row.id : null)}>
                  <ContextMenuTrigger asChild>
                    <tr className={cn(
                      "border-t hover:bg-muted/30 transition-colors cursor-pointer",
                      contextRowId === row.id && "bg-muted/50"
                    )} onDoubleClick={() => onEdit(row)}>
                      <td className={cn("px-2 py-1.5 font-mono text-[10px] sticky left-0 z-10 font-semibold", contextRowId === row.id ? "bg-muted/50" : "bg-background")}>
                        {fmId(row.numero)}
                      </td>
                      <td className="px-2 py-1.5">
                        {(() => {
                          const needsApproval = row.ticket_mensal != null && row.valor_minimo != null && row.ticket_mensal < row.valor_minimo;
                          const alreadyApproved = row.status_aprovacao === "Aprovado";
                          if (!needsApproval || alreadyApproved) return <span className="text-muted-foreground text-[10px]">—</span>;
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] gap-1 px-2"
                              onClick={(e) => { e.stopPropagation(); setAprovacaoTarget(row); }}
                            >
                              <ShieldCheck className="h-3 w-3" />
                              Solicitar
                            </Button>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1.5"><TruncCell value={row.criado_por} max={100} /></td>
                      <td className="px-2 py-1.5"><StatusBadge value={row.status} /></td>
                      <td className="px-2 py-1.5"><TruncCell value={row.tipo_solicitacao} /></td>
                      <td className="px-2 py-1.5"><TruncCell value={row.produto_nt} /></td>
                      <td className="px-2 py-1.5">{row.vigencia != null ? row.vigencia : "—"}</td>
                      <td className={cn("px-2 py-1.5 font-medium", row.status_viabilidade?.includes("ABAIXO") ? "bg-destructive/10 text-destructive" : "")}>
                        {formatCurrency(row.valor_minimo)}
                      </td>
                      <td className="px-2 py-1.5">
                        <StatusBadge 
                          value={
                            row.inviabilidade_tecnica 
                              ? "Inviabilidade Técnica"
                              : (row.viabilidade === "Aguardando Projetista" && !row.distancia_projetista)
                                  ? "Aguardando Projetista"
                                  : (row.ticket_mensal != null && row.valor_minimo != null)
                                      ? (row.ticket_mensal >= row.valor_minimo
                                          ? (row.viabilidade === "Viabilizado pelo Sistema" ? "Viabilizado pelo Sistema" : "Viável")
                                          : "Abaixo do Valor")
                                      : row.viabilidade
                          } 
                        />
                      </td>
                      <td className="px-2 py-1.5">{formatCurrency(row.ticket_mensal)}</td>
                      <td className="px-2 py-1.5"><StatusBadge value={row.status_aprovacao} /></td>
                      <td className="px-2 py-1.5"><TruncCell value={row.aprovado_por} /></td>
                      <td className="px-2 py-1.5"><TruncCell value={row.nome_cliente} /></td>
                      <td className="px-2 py-1.5">
                        {row.previsao_roi != null ? (() => {
                          const { roiEscolhido } = getRoiIndicators(row.dados_precificacao);
                          if (roiEscolhido != null && roiEscolhido > 0) {
                            const ok = row.previsao_roi <= roiEscolhido;
                            const escolhidoStr = (Math.round(roiEscolhido * 100) / 100).toString().replace(".", ",");
                            const previstoStr = row.previsao_roi.toFixed(1).replace(".", ",");
                            return <StatusBadge value={`${previstoStr} / ${escolhidoStr}`} className={ok ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-red-100 text-red-800 border-red-200"} />;
                          }
                          return <span className="text-muted-foreground">{row.previsao_roi.toFixed(1).replace(".", ",")}</span>;
                        })() : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{row.roi_global ?? "—"}</td>
                      <td className="px-2 py-1.5"><StatusBadge value={(() => {
                        const now = new Date();
                        const created = row.created_at ? new Date(row.created_at) : null;
                        const reav = row.data_reavaliacao ? new Date(row.data_reavaliacao) : null;
                        const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
                        // NT Tech products (Firewall, Wifi, Switch, Backup) follow the same 15-day expiration rule
                        const NT_TECH = ["Firewall", "Wifi", "Switch", "Backup"];
                        const isNtTech = row.produto_nt ? NT_TECH.includes(row.produto_nt) : false;
                        const expiryDays = 15; // same rule for Conectividade and NT Tech
                        const baseDate = reav || created;
                        const isAtiva = baseDate ? addDays(baseDate, expiryDays) > now : false;
                        // Mark explicitly so future logic can branch if needed
                        void isNtTech;
                        return isAtiva ? "Ativa" : "Expirada";
                      })()} /></td>
                      <td className="px-2 py-1.5"><TruncCell value={row.projetista} /></td>
                      <td className="px-2 py-1.5"><TruncCell value={row.motivo_solicitacao} /></td>
                      <td className="px-2 py-1.5"><TruncCell value={row.observacoes} max={80} /></td>
                      <td className="px-2 py-1.5"><GuardaChuvaCell value={row.id_guardachuva} /></td>
                      <td className="px-2 py-1.5"><TruncCell value={row.codigo_smark} /></td>
                      <td className="px-2 py-1.5"><TruncCell value={row.inviabilidade_tecnica} /></td>
                      <td className="px-2 py-1.5"><TruncCell value={row.comentarios_aprovador} max={80} /></td>
                      <td className="px-2 py-1.5"><TruncCell value={row.observacao_validacao} max={80} /></td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {row.created_at ? format(new Date(row.created_at), "dd/MM/yyyy HH:mm") : "—"}
                      </td>
                      <td className="px-2 py-1.5"><TruncCell value={row.modificado_por} /></td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {row.updated_at ? format(new Date(row.updated_at), "dd/MM/yyyy HH:mm") : "—"}
                      </td>
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => onEdit(row)} className="gap-2">
                      <Pencil className="h-3.5 w-3.5" /> {canEdit ? "Editar" : "Ver detalhes"}
                    </ContextMenuItem>
                    {(() => {
                      const needsApproval = row.ticket_mensal != null && row.valor_minimo != null && row.ticket_mensal < row.valor_minimo;
                      const alreadyApproved = row.status_aprovacao === "Aprovado";
                      if (!needsApproval || alreadyApproved) return null;
                      return (
                        <ContextMenuItem onClick={() => setAprovacaoTarget(row)} className="gap-2">
                          <ShieldCheck className="h-3.5 w-3.5" /> Solicitar Aprovação
                        </ContextMenuItem>
                      );
                    })()}
                    <ContextMenuItem onClick={() => setHistoryTarget(row)} className="gap-2">
                      <History className="h-3.5 w-3.5" /> Histórico de Versão
                    </ContextMenuItem>
                    {canDelete && (
                      <ContextMenuItem onClick={() => setDeleteTarget(row)} className="gap-2 text-destructive focus:text-destructive focus:bg-muted">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </ContextMenuItem>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              ))
            )}
          </tbody>
        </table>
      </ScrollableTable>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro #{deleteTarget?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VersionHistoryDialog
        open={!!historyTarget}
        onOpenChange={(open) => !open && setHistoryTarget(null)}
        preViabilidadeId={historyTarget?.id ?? null}
        numero={historyTarget?.numero ?? null}
      />

      <SolicitarAprovacaoDialog
        open={!!aprovacaoTarget}
        onOpenChange={(open) => !open && setAprovacaoTarget(null)}
        preViabilidadeId={aprovacaoTarget?.id ?? null}
        numero={aprovacaoTarget?.numero ?? null}
        vigencia={aprovacaoTarget?.vigencia ?? null}
        dadosPrecificacao={(aprovacaoTarget?.dados_precificacao as Record<string, any>) ?? null}
        hasEquipment={false}
        previsaoRoi={(aprovacaoTarget as any)?.previsao_roi ?? null}
      />

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Exibindo {paged.length} de {filtered.length}</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n} / pág</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="flex items-center px-2 text-xs text-muted-foreground">
            {page + 1} / {totalPages || 1}
          </span>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
}
