import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ScrollableTable from "@/components/ui/scrollable-table";
import { Loader2, Search, RefreshCw, Download, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useGeoGridPastas, useGeoGridItensRede, GeoGridItemRede } from "@/hooks/useGeoGridData";
import { useToast } from "@/hooks/use-toast";

export default function GeoGridTab() {
  const { pastas, loading: loadingPastas, fetchPastas } = useGeoGridPastas();
  const { items, loading: loadingItems, error, rawResponse, fetchItensRede } = useGeoGridItensRede();
  const { toast } = useToast();

  const [selectedPasta, setSelectedPasta] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("__all__");
  const [filterPortasLivres, setFilterPortasLivres] = useState<string>("__all__");
  const [hasFetched, setHasFetched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // Load pastas on mount
  useEffect(() => {
    fetchPastas();
  }, [fetchPastas]);

  const handleSearch = async () => {
    if (!selectedPasta) {
      toast({ title: "Selecione uma pasta", description: "Escolha uma pasta/cidade para buscar os itens de rede.", variant: "destructive" });
      return;
    }
    setHasFetched(true);
    await fetchItensRede({ idPasta: selectedPasta });
  };

  // Unique tipos for filter
  const tipoOptions = useMemo(() => {
    const tipos = new Set(items.map((i) => i.tipo).filter(Boolean));
    return Array.from(tipos).sort();
  }, [items]);

  // Reset page when filters change
  const filtered = useMemo(() => {
    setCurrentPage(1);
    let result = items;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (i) =>
          i.sigla.toLowerCase().includes(q) ||
          i.pasta.toLowerCase().includes(q) ||
          i.siglaRecipiente.toLowerCase().includes(q) ||
          i.siglaPoste.toLowerCase().includes(q) ||
          i.tipo.toLowerCase().includes(q) ||
          String(i.id).includes(q)
      );
    }
    if (filterTipo !== "__all__") {
      result = result.filter((i) => i.tipo === filterTipo);
    }
    if (filterPortasLivres === "com_portas") {
      result = result.filter((i) => i.portasLivres > 0);
    } else if (filterPortasLivres === "sem_portas") {
      result = result.filter((i) => i.portasLivres === 0);
    }
    return result;
  }, [items, searchText, filterTipo, filterPortasLivres]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const hasActiveFilters = searchText || filterTipo !== "__all__" || filterPortasLivres !== "__all__";

  const clearFilters = () => {
    setSearchText("");
    setFilterTipo("__all__");
    setFilterPortasLivres("__all__");
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Id", "Sigla", "Pasta", "Sigla (recipiente)", "Sigla (poste)", "Tipo", "Portas Entrada", "Portas", "Portas Reservadas", "Reserv. Cliente", "Atend. Cliente", "Ocupadas", "Livres", "Latitude", "Longitude"];
    const rows = filtered.map((i) => [i.id, i.sigla, i.pasta, i.siglaRecipiente, i.siglaPoste, i.tipo, i.quantidadePortasEntrada, i.quantidadePortas, i.totalPortasReservadas, i.portasReservadasCliente, i.portasAtendimentoCliente, i.portasOcupadas, i.portasLivres, i.latitude ?? "", i.longitude ?? ""]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geogrid_itens_rede_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Search Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consulta de Itens de Rede</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Select value={selectedPasta} onValueChange={setSelectedPasta}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingPastas ? "Carregando pastas..." : "Selecione uma pasta/cidade"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {pastas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={loadingItems || !selectedPasta} className="gap-2">
              {loadingItems ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-2">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {hasFetched && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Itens de Rede
                <Badge variant="secondary" className="text-xs">
                  {filtered.length} {filtered.length !== items.length ? `/ ${items.length}` : ""} itens
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={handleSearch} disabled={loadingItems} className="gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingItems ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filtered.length === 0} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 items-end">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por sigla, pasta, recipiente, poste, tipo..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__all__">Todos os tipos</SelectItem>
                  {tipoOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPortasLivres} onValueChange={setFilterPortasLivres}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue placeholder="Portas livres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as portas</SelectItem>
                  <SelectItem value="com_portas">Com portas livres</SelectItem>
                  <SelectItem value="sem_portas">Sem portas livres</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1 text-muted-foreground">
                  <X className="h-3.5 w-3.5" /> Limpar
                </Button>
              )}
            </div>

            {/* Table */}
            {loadingItems ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Buscando itens de rede...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {items.length === 0
                  ? "Nenhum item de rede encontrado para esta pasta."
                  : "Nenhum item corresponde aos filtros aplicados."}
              </div>
            ) : (
              <ScrollableTable totalScrollableColumns={13}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap text-xs font-semibold">Id</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold">Sigla</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold">Pasta</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold">Sigla (recipiente)</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold">Sigla (poste)</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold">Tipo</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Portas Entrada</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Portas</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Reservadas</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Reserv. Cliente</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Atend. Cliente</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Ocupadas</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Livres</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold">Latitude</TableHead>
                      <TableHead className="whitespace-nowrap text-xs font-semibold">Longitude</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((item, idx) => (
                      <TableRow key={`${item.id}-${idx}`}>
                        <TableCell className="text-xs font-mono">{item.id}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{item.sigla}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{item.pasta}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{item.siglaRecipiente}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{item.siglaPoste}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{item.tipo}</TableCell>
                        <TableCell className="text-xs text-center">{item.quantidadePortasEntrada}</TableCell>
                        <TableCell className="text-xs text-center">{item.quantidadePortas}</TableCell>
                        <TableCell className="text-xs text-center">{item.totalPortasReservadas}</TableCell>
                        <TableCell className="text-xs text-center">{item.portasReservadasCliente}</TableCell>
                        <TableCell className="text-xs text-center">{item.portasAtendimentoCliente}</TableCell>
                        <TableCell className="text-xs text-center">{item.portasOcupadas}</TableCell>
                        <TableCell className="text-xs text-center font-semibold">
                          <span className={item.portasLivres > 0 ? "text-green-600" : "text-destructive"}>
                            {item.portasLivres}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{item.latitude ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{item.longitude ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTable>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3">
                  <span className="text-xs text-muted-foreground">
                    {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 7) {
                        page = i + 1;
                      } else if (currentPage <= 4) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        page = totalPages - 6 + i;
                      } else {
                        page = currentPage - 3 + i;
                      }
                      return (
                        <Button key={page} variant={page === currentPage ? "default" : "outline"} size="icon" className="h-7 w-7 text-xs" onClick={() => setCurrentPage(page)}>
                          {page}
                        </Button>
                      );
                    })}
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            )}

            {/* Raw response debug (collapsed) */}
            {rawResponse && items.length === 0 && (
              <details className="mt-4">
                <summary className="text-xs text-muted-foreground cursor-pointer">Ver resposta bruta da API</summary>
                <pre className="text-[10px] bg-muted p-2 rounded mt-1 max-h-48 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
