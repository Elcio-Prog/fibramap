import { useState, useMemo } from "react";
import { PreViabilidade } from "@/hooks/usePreViabilidades";
import { useUserRole } from "@/hooks/useUserRole";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusBadge from "./StatusBadge";
import ScrollableTable from "@/components/ui/scrollable-table";
import { format } from "date-fns";

interface Props {
  data: PreViabilidade[];
  search: string;
  statusFilter: string;
  onEdit: (item: PreViabilidade) => void;
}

type SortKey = keyof PreViabilidade;

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const PAGE_OPTIONS = [10, 25, 50];

export default function PreViabilidadeTable({ data, search, statusFilter, onEdit }: Props) {
  const { isAdmin } = useUserRole();
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    let list = data;
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.nome_cliente || "").toLowerCase().includes(q) ||
        (r.viabilidade || "").toLowerCase().includes(q) ||
        String(r.numero).includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return list;
  }, [data, statusFilter, search, sortKey, sortDir]);

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

  return (
    <div>
      <ScrollableTable totalScrollableColumns={24}>
        <table className="text-xs w-max min-w-full">
          <thead className="sticky top-0 bg-muted z-10">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap sticky left-0 z-20 bg-muted min-w-[50px] cursor-pointer select-none" onClick={() => toggleSort("numero" as SortKey)}>
                <span className="flex items-center gap-1">Nº <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              {isAdmin && <Th>Editar</Th>}
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
              <Th>ID GuardaChuva</Th>
              <SortHeader field="codigo_smark">Cód. SMARK</SortHeader>
              <Th>Inviab. Técnica</Th>
              <Th>Coment. Aprovador</Th>
              <Th>Obs. Validação</Th>
              <SortHeader field="created_at">Data Criação</SortHeader>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={25} className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr key={row.id} className="border-t hover:bg-muted/30 transition-colors cursor-pointer" onDoubleClick={() => isAdmin && onEdit(row)}>
                  <td className="px-2 py-1.5 font-mono text-[10px] sticky left-0 z-10 bg-background font-semibold">
                    #{row.numero}
                  </td>
                  {isAdmin && (
                    <td className="px-2 py-1.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(row)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </td>
                  )}
                  <td className="px-2 py-1.5"><TruncCell value={row.criado_por} max={100} /></td>
                  <td className="px-2 py-1.5"><StatusBadge value={row.status} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.tipo_solicitacao} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.produto_nt} /></td>
                  <td className="px-2 py-1.5">{row.vigencia != null ? `${row.vigencia} meses` : "—"}</td>
                  <td className={cn("px-2 py-1.5 font-medium", row.status_viabilidade?.includes("ABAIXO") ? "bg-red-100 text-red-700" : "")}>
                    {formatCurrency(row.valor_minimo)}
                  </td>
                  <td className="px-2 py-1.5"><TruncCell value={row.viabilidade} max={100} /></td>
                  <td className="px-2 py-1.5">{formatCurrency(row.ticket_mensal)}</td>
                  <td className="px-2 py-1.5"><StatusBadge value={row.status_aprovacao} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.aprovado_por} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.nome_cliente} /></td>
                  <td className="px-2 py-1.5 text-muted-foreground">{row.previsao_roi ?? "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{row.roi_global ?? "—"}</td>
                  <td className="px-2 py-1.5"><StatusBadge value={row.status_viabilidade} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.projetista} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.motivo_solicitacao} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.observacoes} max={80} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.id_guardachuva} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.codigo_smark} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.inviabilidade_tecnica} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.comentarios_aprovador} max={80} /></td>
                  <td className="px-2 py-1.5"><TruncCell value={row.observacao_validacao} max={80} /></td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {row.created_at ? format(new Date(row.created_at), "dd/MM/yyyy HH:mm") : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollableTable>

      {/* Pagination */}
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
