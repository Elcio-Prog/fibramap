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
    const headers = ["ID", "Sigla", "Cidade", "Portas Livres", "Tipo do Splitter", "Recipiente ID", "Recipiente Sigla", "Recipiente Item", "Latitude", "Longitude"];
    const rows = viabFiltered.map((v) => [v.id, v.sigla, v.pastaNome, v.portasLivres, v.tipoSplitter, v.recipienteId, v.recipienteSigla, v.recipienteItem, v.latitude ?? "", v.longitude ?? ""]);
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
                <ScrollableTable totalScrollableColumns={10}>
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[80px]">ID</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[280px]">Sigla</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[120px]">Cidade</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold text-center min-w-[100px]">Portas Livres</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[130px]">Tipo do Splitter</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[110px]">Recipiente ID</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[150px]">Recipiente Sigla</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[130px]">Recipiente Item</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[120px]">Latitude</TableHead>
                        <TableHead className="whitespace-nowrap text-xs font-semibold min-w-[120px]">Longitude</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viabPaginated.map((v, idx) => (
                        <TableRow key={`${v.id}-${idx}`}>
                          <TableCell className="text-xs font-mono min-w-[80px]">{v.id}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap min-w-[280px]" title={v.sigla}>{v.sigla}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{v.pastaNome || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs text-center font-semibold text-green-600">{v.portasLivres}</TableCell>
                          <TableCell className="text-xs font-mono">{v.recipienteId || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{v.recipienteSigla || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{v.recipienteItem || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-xs font-mono">{v.latitude ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{v.longitude ?? "—"}</TableCell>
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
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 px-3 gap-1" disabled={viabPage <= 1} onClick={() => setViabPage((p) => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Página {viabPage} de {viabTotalPages}
                      </span>
                      <Button variant="outline" size="sm" className="h-8 px-3 gap-1" disabled={viabPage >= viabTotalPages} onClick={() => setViabPage((p) => p + 1)}>
                        Próxima
                        <ChevronRight className="h-4 w-4" />
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
