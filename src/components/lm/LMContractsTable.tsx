import { useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { format, isAfter, isBefore, parseISO, addDays, startOfToday } from "date-fns";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Search,
  Upload as UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { LMContract, LM_FIELD_LABELS, LM_STATUS_OPTIONS, useLMContracts } from "@/hooks/useLMContracts";
import LMContractDrawer from "./LMContractDrawer";
import LMContractImport from "./LMContractImport";
import { exportLMContractsCSV, exportLMContractsXLSX } from "@/lib/lmContractsExport";

const STORAGE_KEY = "lm_contracts_column_visibility";

const DEFAULT_HIDDEN: (keyof LMContract)[] = [
  "login",
  "senha",
  "site_portal",
  "observacao_contrato_lm",
  "observacao_geral",
  "cont_guarda_chuva",
  "item_sap",
];

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Ativo": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    "Cancelado": "bg-destructive/15 text-destructive border-destructive/30",
    "Novo - A instalar": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  };
  return <Badge variant="outline" className={cn("font-medium", map[status] || "")}>{status || "—"}</Badge>;
}

function SenhaCell({ senha }: { senha: string | null }) {
  const [show, setShow] = useState(false);
  if (!senha) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
        {show ? senha : "•".repeat(Math.min(senha.length, 10))}
      </code>
      <button onClick={(e) => { e.stopPropagation(); setShow((s) => !s); }} className="text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </div>
  );
}

const COLUMN_ORDER: (keyof LMContract)[] = [
  "numero",
  "status", "pn", "nome_pn", "grupo", "recorrencia", "cont_guarda_chuva",
  "modelo_tr", "valor_mensal_tr", "observacao_contrato_lm", "item_sap",
  "protocolo_elleven", "nome_cliente", "etiqueta", "num_contrato_cliente",
  "endereco_instalacao", "data_assinatura", "vigencia_meses", "data_termino",
  "is_last_mile", "simples_nacional", "observacao_geral",
  "site_portal", "login", "senha",
];

const SORTABLE_BY_DEFAULT = new Set(["numero", "data_termino", "valor_mensal_tr", "status", "nome_cliente"]);

export default function LMContractsTable() {
  const { data: rows = [], isLoading } = useLMContracts();
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [grupoFilter, setGrupoFilter] = useState<string>("__all__");
  const [lastMileFilter, setLastMileFilter] = useState<"all" | "yes" | "no">("all");
  const [terminoFrom, setTerminoFrom] = useState("");
  const [terminoTo, setTerminoTo] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "data_termino", desc: false }]);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<LMContract | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    const init: VisibilityState = {};
    DEFAULT_HIDDEN.forEach((c) => { init[c] = false; });
    return init;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility)); } catch { /* ignore */ }
  }, [columnVisibility]);

  const grupos = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.grupo && set.add(r.grupo));
    return Array.from(set).sort();
  }, [rows]);

  // Filtragem manual (mais flexível que filterFn por coluna)
  const filteredData = useMemo(() => {
    const q = globalFilter.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = [r.nome_cliente, r.num_contrato_cliente, r.protocolo_elleven, r.endereco_instalacao]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false;
      if (grupoFilter !== "__all__" && r.grupo !== grupoFilter) return false;
      if (lastMileFilter === "yes" && !r.is_last_mile) return false;
      if (lastMileFilter === "no" && r.is_last_mile) return false;
      if (terminoFrom && r.data_termino && isBefore(parseISO(r.data_termino), parseISO(terminoFrom))) return false;
      if (terminoTo && r.data_termino && isAfter(parseISO(r.data_termino), parseISO(terminoTo))) return false;
      return true;
    });
  }, [rows, globalFilter, statusFilter, grupoFilter, lastMileFilter, terminoFrom, terminoTo]);

  const columns = useMemo<ColumnDef<LMContract>[]>(() => {
    const today = startOfToday();
    const in30 = addDays(today, 30);
    void today; void in30;

    const make = (id: keyof LMContract, opts?: { cell?: (v: any, row: LMContract) => React.ReactNode; sortable?: boolean; size?: number }): ColumnDef<LMContract> => ({
      id,
      accessorKey: id as any,
      header: ({ column }) => {
        const can = opts?.sortable ?? SORTABLE_BY_DEFAULT.has(id);
        if (!can) return <span>{LM_FIELD_LABELS[id]}</span>;
        return (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {LM_FIELD_LABELS[id]}
            <ArrowUpDown className="h-3 w-3" />
          </button>
        );
      },
      cell: ({ row }) => {
        const v = (row.original as any)[id];
        if (opts?.cell) return opts.cell(v, row.original);
        if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
        return <span className="text-xs">{String(v)}</span>;
      },
      enableSorting: true,
    });

    return [
      make("numero", { cell: (v) => <span className="text-xs font-semibold tabular-nums text-muted-foreground">#{v}</span>, sortable: true, size: 60 }),
      make("status", { cell: (v) => <StatusBadge status={v} />, sortable: true }),
      make("pn"),
      make("nome_pn"),
      make("grupo"),
      make("recorrencia"),
      make("cont_guarda_chuva"),
      make("modelo_tr"),
      make("valor_mensal_tr", { cell: (v) => <span className="text-xs font-medium tabular-nums">{fmtMoney(v)}</span>, sortable: true }),
      make("observacao_contrato_lm", { cell: (v) => <span className="line-clamp-1 max-w-[200px] text-xs text-muted-foreground" title={v || ""}>{v || "—"}</span> }),
      make("item_sap"),
      make("protocolo_elleven"),
      make("nome_cliente", { sortable: true }),
      make("etiqueta"),
      make("num_contrato_cliente"),
      make("endereco_instalacao", { cell: (v) => <span className="line-clamp-1 max-w-[240px] text-xs" title={v || ""}>{v || "—"}</span> }),
      make("data_assinatura", { cell: (v) => <span className="text-xs tabular-nums">{fmtDate(v)}</span> }),
      make("vigencia_meses", { cell: (v) => <span className="text-xs tabular-nums">{v ?? "—"}</span> }),
      make("data_termino", {
        sortable: true,
        cell: (v) => <span className="text-xs tabular-nums">{fmtDate(v)}</span>,
      }),
      make("is_last_mile", { cell: (v) => <Badge variant={v ? "default" : "secondary"} className="text-[10px]">{v ? "Sim" : "Não"}</Badge> }),
      make("simples_nacional", { cell: (v) => <Badge variant={v ? "default" : "secondary"} className="text-[10px]">{v ? "Sim" : "Não"}</Badge> }),
      make("observacao_geral", { cell: (v) => <span className="line-clamp-1 max-w-[200px] text-xs text-muted-foreground" title={v || ""}>{v || "—"}</span> }),
      make("site_portal", {
        cell: (v) => v ? (
          <a href={v} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="h-3 w-3" /> abrir
          </a>
        ) : <span className="text-muted-foreground">—</span>,
      }),
      make("login"),
      make("senha", { cell: (v) => <SenhaCell senha={v} /> }),
    ];
  }, []);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  useEffect(() => { table.setPageSize(pageSize); }, [pageSize, table]);

  const clearFilters = () => {
    setGlobalFilter("");
    setStatusFilter([]);
    setGrupoFilter("__all__");
    setLastMileFilter("all");
    setTerminoFrom("");
    setTerminoTo("");
  };

  const handleExport = (kind: "xlsx" | "csv") => {
    const visible = filteredData;
    if (kind === "xlsx") exportLMContractsXLSX(visible);
    else exportLMContractsCSV(visible);
  };

  const today = startOfToday();
  const in30 = addDays(today, 30);

  const totalRows = filteredData.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, contrato, protocolo, endereço..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-9 pl-8"
          />
        </div>

        {/* Status (multi) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              Status {statusFilter.length > 0 && <Badge variant="secondary" className="ml-1.5">{statusFilter.length}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            {LM_STATUS_OPTIONS.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox
                  checked={statusFilter.includes(s)}
                  onCheckedChange={(c) => setStatusFilter((p) => c ? [...p, s] : p.filter((x) => x !== s))}
                />
                {s}
              </label>
            ))}
          </PopoverContent>
        </Popover>

        {/* Grupo */}
        <Select value={grupoFilter} onValueChange={setGrupoFilter}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Grupo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os grupos</SelectItem>
            {grupos.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* É Last Mile */}
        <Select value={lastMileFilter} onValueChange={(v) => setLastMileFilter(v as any)}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Last Mile: Todos</SelectItem>
            <SelectItem value="yes">Last Mile: Sim</SelectItem>
            <SelectItem value="no">Last Mile: Não</SelectItem>
          </SelectContent>
        </Select>

        {/* Range data término */}
        <div className="flex items-center gap-1.5">
          <Input type="date" value={terminoFrom} onChange={(e) => setTerminoFrom(e.target.value)} className="h-9 w-[140px]" />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="date" value={terminoTo} onChange={(e) => setTerminoTo(e.target.value)} className="h-9 w-[140px]" />
        </div>

        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Limpar Filtros
        </Button>

        <div className="flex flex-1 justify-end gap-2">
          {/* Colunas */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5"><Columns3 className="h-4 w-4" /> Colunas</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-80 w-64 overflow-y-auto p-2">
              {COLUMN_ORDER.map((id) => {
                const col = table.getColumn(id);
                if (!col) return null;
                return (
                  <label key={id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                    <Checkbox checked={col.getIsVisible()} onCheckedChange={(c) => col.toggleVisibility(!!c)} />
                    {LM_FIELD_LABELS[id]}
                  </label>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* Importar */}
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => setImportOpen(true)}>
            <UploadIcon className="h-4 w-4" /> Importar
          </Button>

          {/* Exportar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5"><Download className="h-4 w-4" /> Exportar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                <FileText className="mr-2 h-4 w-4" /> CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="whitespace-nowrap text-xs">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={table.getAllLeafColumns().length} className="h-24 text-center text-sm text-muted-foreground">
                  Carregando contratos...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={table.getAllLeafColumns().length} className="h-24 text-center text-sm text-muted-foreground">
                  Nenhum contrato encontrado.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const r = row.original;
                let highlight = "";
                if (r.data_termino) {
                  const dt = parseISO(r.data_termino);
                  if (isBefore(dt, today)) highlight = "bg-destructive/10 hover:bg-destructive/15";
                  else if (!isAfter(dt, in30)) highlight = "bg-amber-500/10 hover:bg-amber-500/15";
                }
                return (
                  <TableRow
                    key={row.id}
                    className={cn("cursor-pointer", highlight)}
                    onClick={() => setSelected(r)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Mostrando {from}–{to} de {totalRows} contratos
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {pageIndex + 1} de {Math.max(1, table.getPageCount())}
          </span>
          <Button size="sm" variant="outline" className="h-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <LMContractDrawer contract={selected} open={!!selected} onClose={() => setSelected(null)} />
      <LMContractImport open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
