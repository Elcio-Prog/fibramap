import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ScrollableTable from "@/components/ui/scrollable-table";
import { Loader2, Search, Download, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { useGeoGridViabilidade } from "@/hooks/useGeoGridData";

export default function GeoGridTab() {
  const { items: viabItems, loading: loadingViab, enriching: enrichingViab, enrichProgress, error: errorViab, dbLoaded: viabDbLoaded, syncStats, fetchViabilidade } = useGeoGridViabilidade();

  const [viabPage, setViabPage] = useState(1);
  const [viabSearchText, setViabSearchText] = useState("");
  const [viabFetched, setViabFetched] = useState(false);
  const PAGE_SIZE = 50;

  // Viabilidade helpers
  const handleFetchViabilidade = async () => {
    setViabFetched(true);
    await fetchViabilidade();
  };

  const viabFiltered = useMemo(() => {
    setViabPage(1);
    if (!viabSearchText.trim()) return viabItems;
    const q = viabSearchText.toLowerCase();
    return viabItems.filter(
      (v) => String(v.id).includes(q) || v.sigla.toLowerCase().includes(q)
    );
  }, [viabItems, viabSearchText]);

  const viabTotalPages = Math.max(1, Math.ceil(viabFiltered.length / PAGE_SIZE));
  const viabPaginated = useMemo(() => {
    const start = (viabPage - 1) * PAGE_SIZE;
    return viabFiltered.slice(start, start + PAGE_SIZE);
  }, [viabFiltered, viabPage]);

  const handleExportViabCsv = () => {
    if (viabFiltered.length === 0) return;
    const headers = ["ID", "Sigla", "Item", "Portas Livres", "Latitude", "Longitude", "Recipiente ID", "Recipiente Item", "Recipiente Sigla", "Pasta"];
    const rows = viabFiltered.map((v) => [v.id, v.sigla, v.item, v.portasLivres, v.latitude ?? "", v.longitude ?? "", v.recipienteId, v.recipienteItem, v.recipienteSigla, v.pastaNome]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geogrid_portas_livres_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">GeoGrid</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Consulta de Itens de Rede</h3>
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
              <div className="w-full sm:w-40">
                <Select value={selectedItem} onValueChange={setSelectedItem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="poste">Poste</SelectItem>
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

            {hasFetched && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Itens de Rede</span>
                    <Badge variant="secondary" className="text-xs">
                      {filtered.length} {filtered.length !== items.length ? `/ ${items.length}` : ""} itens
                    </Badge>
                  </div>
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
                  <>
                    <ScrollableTable totalScrollableColumns={14}>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="whitespace-nowrap text-xs font-semibold">Id</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold">Sigla</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold">Pasta</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold">Sigla (recipiente)</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold">Sigla (poste)</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold">Valor</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold">Tipo</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Quantidade portas de entrada</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Quantidade portas</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Total portas reservadas</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Portas reservadas (cliente)</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Portas atendimento cliente</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Portas ocupadas</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Portas livres</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold">latitude</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold">longitude</TableHead>
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
                              <TableCell className="text-xs whitespace-nowrap">{item.valor}</TableCell>
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
                  </>
                )}

                {/* Raw response debug */}
                {rawResponse && items.length === 0 && (
                  <details className="mt-4">
                    <summary className="text-xs text-muted-foreground cursor-pointer">Ver resposta bruta da API</summary>
                    <pre className="text-[10px] bg-muted p-2 rounded mt-1 max-h-48 overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(rawResponse, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="border-t" />

          {/* Busca de Portas Livres */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-600" />
                <h3 className="text-sm font-semibold">Busca de Portas Livres</h3>
                {(viabFetched || viabItems.length > 0) && (
                  <Badge variant="secondary" className="text-xs">
                    {viabFiltered.length} itens
                  </Badge>
                )}
              </div>
              <Button
                onClick={handleFetchViabilidade}
                disabled={loadingViab}
                className="gap-1.5"
                size="sm"
              >
                {loadingViab ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Buscar Viabilidade
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Filtra automaticamente: <code className="bg-muted px-1 rounded">portasLivres &gt; 0</code> e <code className="bg-muted px-1 rounded">statusViabilidade = "possui"</code>.
              Enriquece com dados de <code className="bg-muted px-1 rounded">/itensRede/&#123;id&#125;/mapa</code> + <code className="bg-muted px-1 rounded">/pastas</code>.
            </p>

            {errorViab && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md p-2">
                {errorViab}
              </div>
            )}

            {(loadingViab || enrichingViab) && (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {enrichingViab
                      ? `Enriquecendo dados... ${enrichProgress.done}/${enrichProgress.total}`
                      : "Buscando viabilidade..."}
                  </span>
                </div>
                {enrichingViab && enrichProgress.total > 0 && (
                  <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(enrichProgress.done / enrichProgress.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {syncStats && !loadingViab && !enrichingViab && (
              <div className="flex items-center gap-3 text-xs">
                {syncStats.added > 0 && <Badge variant="default" className="text-[10px]">+{syncStats.added} novos</Badge>}
                {syncStats.removed > 0 && <Badge variant="destructive" className="text-[10px]">-{syncStats.removed} removidos</Badge>}
                {syncStats.updated > 0 && <Badge variant="outline" className="text-[10px]">{syncStats.updated} enriquecidos</Badge>}
                {syncStats.added === 0 && syncStats.removed === 0 && <span className="text-muted-foreground">Nenhuma alteração detectada</span>}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Buscar por ID, sigla..."
                value={viabSearchText}
                onChange={(e) => { setViabSearchText(e.target.value); setViabPage(1); }}
                className="h-8 text-sm max-w-sm"
              />
              <Button variant="outline" size="sm" onClick={handleExportViabCsv} disabled={viabFiltered.length === 0} className="gap-1.5 h-8">
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>

            {viabFiltered.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {(viabFetched || viabItems.length > 0) ? "Nenhum item encontrado com portas livres e viabilidade." : "Clique em \"Buscar Viabilidade\" para carregar os dados."}
              </div>
            ) : (
              <>
                <ScrollableTable totalScrollableColumns={8}>
                  <Table className="min-w-[1400px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="whitespace-nowrap text-xs font-semibold sticky left-0 z-10 bg-muted/95 backdrop-blur-sm min-w-[80px]">ID</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold sticky left-[80px] z-10 bg-muted/95 backdrop-blur-sm min-w-[220px] border-r">Sigla</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[100px]">Item</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold text-center min-w-[100px]">Portas Livres</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[120px]">Latitude</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[120px]">Longitude</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[110px]">Recipiente ID</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[130px]">Recipiente Item</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[150px]">Recipiente Sigla</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[160px]">Pasta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viabPaginated.map((v, idx) => (
                        <TableRow key={`${v.id}-${idx}`}>
                          <TableCell className="text-xs font-mono sticky left-0 z-10 bg-background min-w-[80px]">{v.id}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap sticky left-[80px] z-10 bg-background min-w-[220px] border-r max-w-[300px] truncate" title={v.sigla}>{v.sigla}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{v.item || "—"}</TableCell>
                          <TableCell className="text-xs text-center font-semibold text-green-600">{v.portasLivres}</TableCell>
                          <TableCell className="text-xs font-mono">{v.latitude ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{v.longitude ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{v.recipienteId || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{v.recipienteItem || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{v.recipienteSigla || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{v.pastaNome || <span className="text-muted-foreground">—</span>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTable>

                {viabTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-xs text-muted-foreground">
                      {(viabPage - 1) * PAGE_SIZE + 1}–{Math.min(viabPage * PAGE_SIZE, viabFiltered.length)} de {viabFiltered.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={viabPage <= 1} onClick={() => setViabPage((p) => p - 1)}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={viabPage >= viabTotalPages} onClick={() => setViabPage((p) => p + 1)}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
