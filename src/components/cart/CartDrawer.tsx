import { useState, useMemo } from "react";
import { useCart, CartItem } from "@/contexts/CartContext";
import { useConfig } from "@/hooks/useConfig";
import { useBulkExport } from "@/hooks/useBulkExport";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Download, Send, Loader2, X, ArrowUpDown, Search } from "lucide-react";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortField = "cliente" | "stage" | "batchTitle" | "created_at";

export default function CartDrawer({ open, onOpenChange }: Props) {
  const { items, removeItem, clearCart } = useCart();
  const { webhook, fieldMapping } = useConfig();
  const { send, sending, progress, error, setError, buildPayloadItem } = useBulkExport();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [originFilter, setOriginFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("cliente");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const origins = useMemo(() => {
    const set = new Set(items.map((i) => i.batchTitle));
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (originFilter !== "all") list = list.filter((i) => i.batchTitle === originFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        (i.cliente || "").toLowerCase().includes(q) ||
        (i.designacao || "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const va = (a[sortField] ?? "") as string;
      const vb = (b[sortField] ?? "") as string;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return list;
  }, [items, originFilter, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const exportCart = (format: "xlsx" | "csv") => {
    const rows = items.map((item) => buildPayloadItem(item));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Carrinho");
    if (format === "csv") {
      XLSX.writeFile(wb, `carrinho_${new Date().toISOString().slice(0, 10)}.csv`, { bookType: "csv" });
    } else {
      XLSX.writeFile(wb, `carrinho_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
  };

  const handleSend = async () => {
    setConfirmOpen(false);
    const ok = await send();
    if (ok) {
      toast({ title: "Envio realizado com sucesso para o Microsoft Lists!" });
      onOpenChange(false);
    } else {
      toast({ title: "Falha no envio", description: error || "Verifique a URL do Webhook nas Configurações.", variant: "destructive" });
    }
  };

  const webhookConfigured = !!webhook.url;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              Carrinho de Pré-Viabilidades
              <Badge variant="secondary">{items.length} registros</Badge>
            </SheetTitle>
            <SheetDescription>
              Revise e envie os registros selecionados para a lista externa.
            </SheetDescription>
          </SheetHeader>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 p-4 border-b">
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Buscar cliente ou protocolo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Filtrar por origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {origins.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                {items.length === 0 ? "Carrinho vazio" : "Nenhum resultado encontrado"}
              </div>
            ) : (
              <table className="text-xs w-full">
                <thead className="sticky top-0 bg-muted z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left cursor-pointer" onClick={() => toggleSort("cliente")}>
                      <span className="flex items-center gap-1">Cliente <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="px-2 py-1.5 text-left">Designação</th>
                    <th className="px-2 py-1.5 text-left cursor-pointer" onClick={() => toggleSort("stage")}>
                      <span className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="px-2 py-1.5 text-left cursor-pointer" onClick={() => toggleSort("batchTitle")}>
                      <span className="flex items-center gap-1">Origem <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="px-2 py-1.5 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1 max-w-[120px] truncate">{item.cliente || "—"}</td>
                      <td className="px-2 py-1 max-w-[100px] truncate">{item.designacao || "—"}</td>
                      <td className="px-2 py-1">
                        <Badge variant={item.is_viable ? "default" : "outline"} className="text-[10px]">
                          {item.is_viable ? "Viável" : "Inviável"}
                        </Badge>
                      </td>
                      <td className="px-2 py-1 max-w-[120px] truncate">{item.batchTitle}</td>
                      <td className="px-2 py-1 text-center">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(item.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="border-t p-4 space-y-3">
              {sending && progress && (
                <div className="space-y-1">
                  <Progress value={(progress.current / progress.total) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Enviando lote {progress.current} de {progress.total}...
                  </p>
                </div>
              )}
              {error && (
                <div className="text-xs text-destructive bg-destructive/10 rounded p-2 flex items-center justify-between">
                  <span>{error}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setError(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        className="gap-2 flex-1"
                        disabled={!webhookConfigured || sending}
                        onClick={() => setConfirmOpen(true)}
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Enviar ({items.length})
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!webhookConfigured && (
                    <TooltipContent>Configure o Webhook em Configurações antes de enviar</TooltipContent>
                  )}
                </Tooltip>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => exportCart("xlsx")}>
                  <Download className="h-3.5 w-3.5" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => exportCart("csv")}>
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={clearCart}>
                  Limpar Carrinho
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar Envio</DialogTitle>
            <DialogDescription>
              Você está prestes a enviar {items.length} registros para a Lista de Pré-Viabilidades.
            </DialogDescription>
          </DialogHeader>
          <Accordion type="single" collapsible>
            <AccordionItem value="preview">
              <AccordionTrigger className="text-sm">Preview dos registros</AccordionTrigger>
              <AccordionContent>
                <div className="max-h-[200px] overflow-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr>
                        <th className="text-left px-1">Protocolo</th>
                        <th className="text-left px-1">Cliente</th>
                        <th className="text-left px-1">Endereço</th>
                        <th className="text-left px-1">Status</th>
                        <th className="text-left px-1">Origem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((i) => (
                        <tr key={i.id} className="border-t">
                          <td className="px-1 py-0.5 truncate max-w-[80px]">{i.designacao || "—"}</td>
                          <td className="px-1 py-0.5 truncate max-w-[80px]">{i.cliente || "—"}</td>
                          <td className="px-1 py-0.5 truncate max-w-[100px]">{i.endereco || "—"}</td>
                          <td className="px-1 py-0.5">{i.is_viable ? "Viável" : "Inviável"}</td>
                          <td className="px-1 py-0.5 truncate max-w-[80px]">{i.batchTitle}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleSend} className="gap-2">
              <Send className="h-4 w-4" /> Confirmar Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
