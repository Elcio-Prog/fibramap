import { useState, useMemo, useCallback, useRef } from "react";
import { useCart, CartItem } from "@/contexts/CartContext";
import { supabase as sb } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConfig } from "@/hooks/useConfig";
import { supabase } from "@/integrations/supabase/client";
import { useBulkExport, REQUIRED_CART_FIELDS, getIncompleteItems } from "@/hooks/useBulkExport";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPO_SOLICITACAO_OPTIONS, BLOCO_IP_OPTIONS, VIGENCIA_OPTIONS } from "@/lib/field-options";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Download, Loader2, X, ArrowUpDown, Search, Pencil, AlertTriangle, FileCheck } from "lucide-react";
import ScrollableTable from "@/components/ui/scrollable-table";
import * as XLSX from "xlsx";
import CartEditableCell from "./CartEditableCell";
import BulkFillModal from "./BulkFillModal";
import ModalEscolhaDistancia, { type DistanciaChoice } from "@/components/pre-viabilidade/ModalEscolhaDistancia";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortField = "cliente" | "stage" | "batchTitle" | "created_at";

const PRODUTO_OPTIONS = [
  "NT LINK DEDICADO FULL", "NT LINK DEDICADO FLEX", "NT LINK EMPRESA",
  "NT LINK IP TRANSITO", "NT EVENTO", "NT PTT", "NT L2L", "NT DARK FIBER",
];
const TECNOLOGIA_OPTIONS = ["GPON", "PTP", "LAST MILE"];
const MEIO_FISICO_OPTIONS = ["Fibra", "Rádio"];

/** Map subproduto (e.g. "NT LINK DEDICADO FULL") → categoria NT (e.g. "Conectividade") */
function getCategoriaNT(subproduto: string | null | undefined): string {
  if (!subproduto) return "Conectividade";
  const s = subproduto.toUpperCase();
  if (s.startsWith("NT LINK") || s === "NT EVENTO" || s === "NT PTT" || s === "NT L2L" || s === "NT DARK FIBER") return "Conectividade";
  if (s.includes("FIREWALL")) return "Firewall";
  if (s.includes("SWITCH")) return "Switch";
  if (s.includes("WIFI") || s.includes("WIRELESS") || s.includes("AP")) return "Wifi";
  if (s.includes("VOZ") || s.includes("PABX") || s.includes("TELEFONE")) return "VOZ";
  if (s.includes("BACKUP")) return "Backup";
  return "Conectividade";
}

export default function CartDrawer({ open, onOpenChange }: Props) {
  const { items, removeItem, clearCart, updateItem } = useCart();
  const { user } = useAuth();
  const { webhook, fieldMapping } = useConfig();
  const { send, sending, progress, error, setError, buildPayloadItem } = useBulkExport();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [originFilter, setOriginFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("cliente");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkFillOpen, setBulkFillOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [obsDetailItem, setObsDetailItem] = useState<CartItem | null>(null);
  const [addingPreViab, setAddingPreViab] = useState(false);
  const [recalcIds, setRecalcIds] = useState<Set<string>>(new Set());
  const recalcTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [distChoiceOpen, setDistChoiceOpen] = useState(false);

  // Recalculate final_value via edge function
  const recalcItem = useCallback(async (item: CartItem, updates: Partial<CartItem>) => {
    const merged = { ...item, ...updates };
    const vigenciaNum = merged.vigencia ? parseInt(merged.vigencia, 10) || 12 : 12;
    const payload = {
      produto: "Conectividade" as const,
      subproduto: merged.produto || "NT LINK DEDICADO FULL",
      rede: merged.cidade || "",
      banda: merged.velocidade_mbps ?? 0,
      distancia: merged.distance_m ?? 0,
      blocoIp: merged.bloco_ip || "",
      tecnologia: merged.tecnologia || "GPON",
      vigencia: vigenciaNum,
      taxaInstalacao: merged.taxa_instalacao ?? 0,
      togDistancia: true,
      projetoAvaliado: false,
      custoLastMile: 0,
      valorLastMile: 0,
      custosMateriaisAdicionais: 0,
      valorOpex: 0,
    };
    setRecalcIds(prev => new Set(prev).add(item.id));
    try {
      const { data: result } = await sb.functions.invoke("calcular-precificacao", { body: payload });
      if (result && typeof result.valorMinimo === "number") {
        updateItem(item.id, { final_value: result.valorMinimo });
      }
    } catch { /* silent */ }
    setRecalcIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
  }, [updateItem]);

  // Debounced update + recalc for pricing fields
  const updateAndRecalc = useCallback((item: CartItem, updates: Partial<CartItem>) => {
    updateItem(item.id, updates);
    if (recalcTimers.current[item.id]) clearTimeout(recalcTimers.current[item.id]);
    recalcTimers.current[item.id] = setTimeout(() => {
      recalcItem(item, updates);
    }, 600);
  }, [updateItem, recalcItem]);

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

  const incompleteItems = useMemo(() => getIncompleteItems(items), [items]);
  const completeCount = items.length - incompleteItems.length;
  const hasIncomplete = incompleteItems.length > 0;

  const isFieldMissing = (item: CartItem, key: keyof CartItem) => {
    const v = item[key];
    return v == null || v === "";
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

  const handleAddPreViab = async () => {
    if (!user) return;
    const selectedItems = items.filter(i => selectedIds.has(i.id));
    if (selectedItems.length === 0) {
      toast({ title: "Nenhum item selecionado", description: "Selecione ao menos um item para enviar.", variant: "destructive" });
      return;
    }
    // Open distance choice modal
    setDistChoiceOpen(true);
  };

  const executeAddPreViab = async (choice: DistanciaChoice) => {
    setDistChoiceOpen(false);
    if (!user) return;
    const selectedItems = items.filter(i => selectedIds.has(i.id));
    if (selectedItems.length === 0) return;
    setAddingPreViab(true);
    try {
      const payloads = selectedItems.map((item) => {
        const categoriaNT = getCategoriaNT(item.produto);
        const distSistema = item.distance_m ?? null;
        const isViavel = item.is_viable === true;

        let viabilidade: string | null = item.designacao || null;
        if (choice === "sistema" && isViavel) {
          viabilidade = "Viabilizado pelo Sistema";
        } else if (choice === "projetista") {
          viabilidade = "Aguardando Projetista";
        }

        return {
          user_id: user.id,
          criado_por: user.email || null,
          produto_nt: categoriaNT,
          vigencia: item.vigencia ? parseInt(item.vigencia, 10) || null : null,
          viabilidade,
          ticket_mensal: item.valor_a_ser_vendido ?? null,
          observacoes: item.observacoes_user || null,
          valor_minimo: item.final_value ?? null,
          origem: "fibramap",
          tipo_solicitacao: item.tipo_solicitacao || null,
          nome_cliente: item.cliente || null,
          motivo_solicitacao: null,
          codigo_smark: item.codigo_smark || null,
          cnpj_cliente: item.cnpj_cliente || null,
          endereco: item.endereco || null,
          coordenadas: item.lat && item.lng ? `${item.lat}, ${item.lng}` : null,
          status: "Aberto",
          distancia_sistema: distSistema,
          distancia_projetista: choice === "sistema" ? distSistema : null,
          dados_precificacao: {
            produto: categoriaNT,
            subproduto: item.produto || "NT LINK DEDICADO FULL",
            banda: item.velocidade_mbps ?? 0,
            distancia: choice === "sistema" ? (item.distance_m ?? 0) : 0,
            blocoIp: item.bloco_ip || "",
            tecnologia: item.tecnologia || "GPON",
            tecnologiaMeioFisico: item.tecnologia_meio_fisico || "Fibra",
            rede: item.cidade || "",
            vigencia: item.vigencia ? parseInt(item.vigencia, 10) || 12 : 12,
            taxaInstalacao: item.taxa_instalacao ?? 0,
          },
        };
      });
      const { error: insertErr } = await supabase.from("pre_viabilidades" as any).insert(payloads as any);
      if (insertErr) throw insertErr;

      // Log to send history
      const loteId = crypto.randomUUID();
      await (supabase.from("logs_envio_sharepoint") as any).insert({
        user_id: user.id,
        usuario_email: user.email || "",
        id_lote: loteId,
        quantidade_itens: selectedItems.length,
        status: "sucesso",
        response_code: 200,
        item_ids: selectedItems.map(i => i.id),
      });

      // Remove sent items from cart
      selectedItems.forEach(i => removeItem(i.id));
      setSelectedIds(new Set());

      toast({ title: `${selectedItems.length} registros enviados à Pré Viabilidade!` });
    } catch (e: any) {
      // Log failure
      try {
        const loteId = crypto.randomUUID();
        await (supabase.from("logs_envio_sharepoint") as any).insert({
          user_id: user.id,
          usuario_email: user.email || "",
          id_lote: loteId,
          quantidade_itens: selectedItems.length,
          status: "erro",
          mensagem_erro: e.message,
          item_ids: selectedItems.map(i => i.id),
        });
      } catch { /* silent */ }
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setAddingPreViab(false);
    }
  };

  const webhookConfigured = !!webhook.url;
  const canSend = webhookConfigured && !hasIncomplete && !sending;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id));
  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(i => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(i => next.add(i.id));
        return next;
      });
    }
  };

  const sendDisabledReason = !webhookConfigured
    ? "Configure o Webhook em Configurações antes de enviar"
    : hasIncomplete
    ? "Existem registros com campos obrigatórios não preenchidos."
    : "";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-4xl flex flex-col p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              Carrinho de Pré-Viabilidades
              <Badge variant="secondary">{items.length} registros</Badge>
            </SheetTitle>
            <SheetDescription>
              Revise e envie os registros selecionados para a lista externa.
            </SheetDescription>
          </SheetHeader>

          {/* Summary panel */}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-3 p-3 border-b bg-muted/30 text-xs">
              <span>Total: <strong>{items.length}</strong></span>
              <span className="text-primary">Selecionados: <strong>{selectedIds.size}</strong></span>
              <span>Completos: <strong>{completeCount}</strong></span>
              {hasIncomplete && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Pendentes: <strong>{incompleteItems.length}</strong>
                </span>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 p-3 border-b">
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
              <ScrollableTable totalScrollableColumns={17}>
                <table className="text-xs w-max min-w-full">
                  <thead className="sticky top-0 bg-muted z-10">
                    <tr>
                      <th className="px-2 py-1.5 text-center w-8 sticky left-0 z-20 bg-muted">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleAllFiltered}
                          className="h-3.5 w-3.5"
                        />
                      </th>
                      <th className="px-2 py-1.5 text-left min-w-[100px] sticky left-[32px] z-20 bg-muted">Designação</th>
                      <th className="px-2 py-1.5 text-left min-w-[100px] cursor-pointer" onClick={() => toggleSort("cliente")}>
                        <span className="flex items-center gap-1">Cliente <ArrowUpDown className="h-3 w-3" /></span>
                      </th>
                      <th className="px-2 py-1.5 text-left">Coordenadas</th>
                      <th className="px-2 py-1.5 text-right">Distância</th>
                      <th className="px-2 py-1.5 text-left cursor-pointer" onClick={() => toggleSort("stage")}>
                        <span className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></span>
                      </th>
                      <th className="px-2 py-1.5 text-right">Vlr Mínimo</th>
                      <th className="px-2 py-1.5 text-left">Produto *</th>
                      <th className="px-2 py-1.5 text-left">Tecnologia *</th>
                      <th className="px-2 py-1.5 text-left">Meio Físico</th>
                      <th className="px-2 py-1.5 text-left">Vel. *</th>
                      <th className="px-2 py-1.5 text-left">Vigência *</th>
                      <th className="px-2 py-1.5 text-left">Taxa Inst. *</th>
                      <th className="px-2 py-1.5 text-left">Vlr Venda *</th>
                      <th className="px-2 py-1.5 text-left">CNPJ</th>
                      <th className="px-2 py-1.5 text-left">Bloco IP</th>
                      <th className="px-2 py-1.5 text-left">Tipo Sol.</th>
                      <th className="px-2 py-1.5 text-left">Cód. Smark</th>
                      <th className="px-2 py-1.5 text-left">Observações</th>
                      <th className="px-2 py-1.5 text-left cursor-pointer" onClick={() => toggleSort("batchTitle")}>
                        <span className="flex items-center gap-1">Origem <ArrowUpDown className="h-3 w-3" /></span>
                      </th>
                      <th className="px-2 py-1.5 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-muted/30">
                        <td className="px-2 py-1 text-center sticky left-0 z-10 bg-background">
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                            className="h-3.5 w-3.5"
                          />
                        </td>
                        <td className="px-2 py-1 max-w-[100px] truncate font-medium sticky left-[32px] z-10 bg-background">
                          {item.designacao || "—"}
                        </td>
                        <td className="px-2 py-1 max-w-[100px]">
                          {item.batchId === "single-search" ? (
                            <CartEditableCell
                              value={item.cliente || ""}
                              onSave={(v) => updateItem(item.id, { cliente: v })}
                              width="w-[100px]"
                            />
                          ) : (
                            <span className="truncate block">{item.cliente || "—"}</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="max-w-[80px] truncate block">{item.coordenadas || "—"}</span>
                            </TooltipTrigger>
                            {item.coordenadas && <TooltipContent>{item.coordenadas}</TooltipContent>}
                          </Tooltip>
                        </td>
                        <td className="px-2 py-1 text-right">
                          {item.distance_m != null ? `${Math.round(item.distance_m).toLocaleString("pt-BR")} m` : "—"}
                        </td>
                        <td className="px-2 py-1">
                          <Badge variant={item.is_viable ? "default" : "outline"} className="text-[10px]">
                            {item.is_viable ? "Viável" : "Inviável"}
                          </Badge>
                        </td>
                        {/* Vlr Mínimo */}
                        <td className="px-2 py-1 text-right font-semibold text-primary text-[11px]">
                          {recalcIds.has(item.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin inline" />
                          ) : item.final_value != null ? `R$ ${item.final_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                        {/* Produto */}
                        <td className={`px-1 py-0.5 ${isFieldMissing(item, "produto") ? "bg-destructive/10" : ""}`}>
                          <Select value={item.produto || ""} onValueChange={(v) => updateAndRecalc(item, { produto: v })}>
                            <SelectTrigger className="h-7 text-[10px] w-[140px] border-dashed">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {PRODUTO_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Tecnologia */}
                        <td className={`px-1 py-0.5 ${isFieldMissing(item, "tecnologia") ? "bg-destructive/10" : ""}`}>
                          <Select value={item.tecnologia || ""} onValueChange={(v) => updateAndRecalc(item, { tecnologia: v })}>
                            <SelectTrigger className="h-7 text-[10px] w-[90px] border-dashed">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {TECNOLOGIA_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Meio Físico */}
                        <td className="px-1 py-0.5">
                          <Select value={item.tecnologia_meio_fisico || ""} onValueChange={(v) => updateAndRecalc(item, { tecnologia_meio_fisico: v })}>
                            <SelectTrigger className="h-7 text-[10px] w-[80px] border-dashed">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {MEIO_FISICO_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Velocidade */}
                        <td className={`px-1 py-0.5 ${isFieldMissing(item, "velocidade_mbps") ? "bg-destructive/10" : ""}`}>
                          <CartEditableCell
                            value={item.velocidade_mbps != null ? String(item.velocidade_mbps) : ""}
                            type="number"
                            onSave={(v) => updateAndRecalc(item, { velocidade_mbps: v ? parseFloat(v) : null })}
                            width="w-[70px]"
                          />
                        </td>
                        {/* Vigência */}
                        <td className={`px-1 py-0.5 ${isFieldMissing(item, "vigencia") ? "bg-destructive/10" : ""}`}>
                          <Select value={item.vigencia || ""} onValueChange={(v) => updateAndRecalc(item, { vigencia: v })}>
                            <SelectTrigger className="h-7 text-[10px] w-[80px] border-dashed">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {VIGENCIA_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Taxa Instalação */}
                        <td className={`px-1 py-0.5 ${isFieldMissing(item, "taxa_instalacao") ? "bg-destructive/10" : ""}`}>
                          <CartEditableCell
                            value={item.taxa_instalacao != null ? String(item.taxa_instalacao) : ""}
                            type="number"
                            onSave={(v) => updateAndRecalc(item, { taxa_instalacao: v !== "" ? parseFloat(v) : null })}
                            width="w-[80px]"
                          />
                        </td>
                        {/* Valor Vendido */}
                        <td className={`px-1 py-0.5 ${isFieldMissing(item, "valor_a_ser_vendido") ? "bg-destructive/10" : ""}`}>
                          <CartEditableCell
                            value={item.valor_a_ser_vendido != null ? String(item.valor_a_ser_vendido) : ""}
                            type="number"
                            onSave={(v) => updateItem(item.id, { valor_a_ser_vendido: v ? parseFloat(v) : null })}
                            width="w-[80px]"
                          />
                        </td>
                        {/* CNPJ */}
                        <td className="px-1 py-0.5">
                          <CartEditableCell
                            value={item.cnpj_cliente}
                            onSave={(v) => updateItem(item.id, { cnpj_cliente: v })}
                            width="w-[130px]"
                            mask="cnpj"
                          />
                        </td>
                        {/* Bloco IP - dropdown */}
                        <td className="px-1 py-0.5">
                          <Select value={item.bloco_ip || ""} onValueChange={(v) => updateAndRecalc(item, { bloco_ip: v })}>
                            <SelectTrigger className="h-6 text-[10px] w-[110px] border-dashed">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {BLOCO_IP_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Tipo Solicitação - dropdown */}
                        <td className="px-1 py-0.5">
                          <Select value={item.tipo_solicitacao || ""} onValueChange={(v) => updateItem(item.id, { tipo_solicitacao: v })}>
                            <SelectTrigger className="h-6 text-[10px] w-[130px] border-dashed">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIPO_SOLICITACAO_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Cód. Smark */}
                        <td className="px-1 py-0.5">
                          <CartEditableCell
                            value={item.codigo_smark}
                            onSave={(v) => updateItem(item.id, { codigo_smark: v })}
                            width="w-[90px]"
                          />
                        </td>
                        {/* Observações */}
                        <td className="px-1 py-0.5">
                          <div
                            className="flex items-center gap-0.5 cursor-pointer group w-[120px] min-h-[24px] px-1 rounded border border-transparent hover:border-dashed hover:border-muted-foreground/40"
                            onClick={() => setObsDetailItem(item)}
                          >
                            <span className="truncate text-[10px]">{item.observacoes_user || item.observacoes_system ? (item.observacoes_user || "Ver obs.") : "—"}</span>
                            <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                          </div>
                        </td>
                        <td className="px-2 py-1 max-w-[100px] truncate">{item.batchTitle}</td>
                        <td className="px-2 py-1 text-center">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            )}
          </div>

          {/* Bulk selection bar */}
          {selectedIds.size > 0 && (
            <div className="border-t p-2 bg-muted/50 flex items-center gap-3 text-xs">
              <span className="font-medium">{selectedIds.size} selecionados</span>
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => setBulkFillOpen(true)}>
                <Pencil className="h-3 w-3" /> Preencher selecionados
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
            </div>
          )}

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
                <Button
                  className="gap-1"
                  size="sm"
                  onClick={handleAddPreViab}
                  disabled={addingPreViab || selectedIds.size === 0}
                >
                  {addingPreViab ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
                  Enviar Pré Viabilidade ({selectedIds.size})
                </Button>
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
                        <th className="text-left px-1">Produto</th>
                        <th className="text-left px-1">Status</th>
                        <th className="text-left px-1">Origem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((i) => (
                        <tr key={i.id} className="border-t">
                          <td className="px-1 py-0.5 truncate max-w-[80px]">{i.designacao || "—"}</td>
                          <td className="px-1 py-0.5 truncate max-w-[80px]">{i.cliente || "—"}</td>
                          <td className="px-1 py-0.5 truncate max-w-[100px]">{i.produto || "—"}</td>
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
              <FileCheck className="h-4 w-4" /> Confirmar Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Fill Modal */}
      <BulkFillModal
        open={bulkFillOpen}
        onOpenChange={setBulkFillOpen}
        selectedIds={selectedIds}
      />

      {/* Observations Detail Dialog */}
      <Dialog open={!!obsDetailItem} onOpenChange={(open) => !open && setObsDetailItem(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto z-[2100]" style={{ zIndex: 2100 }}>
          <DialogHeader>
            <DialogTitle>Observações - {obsDetailItem?.designacao || obsDetailItem?.cliente || "Item"}</DialogTitle>
            <DialogDescription>
              Detalhes completos das observações deste registro.
            </DialogDescription>
          </DialogHeader>
          {obsDetailItem && (
            <div className="text-sm">
              <Label className="text-xs font-semibold text-muted-foreground">Observações</Label>
              <Textarea
                className="mt-1 text-xs min-h-[200px]"
                value={obsDetailItem.observacoes_user || ""}
                onChange={(e) => {
                  const newVal = e.target.value;
                  updateItem(obsDetailItem.id, { observacoes_user: newVal });
                  setObsDetailItem({ ...obsDetailItem, observacoes_user: newVal });
                }}
                placeholder="Adicionar observação..."
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
