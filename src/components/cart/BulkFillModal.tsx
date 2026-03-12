import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TIPO_SOLICITACAO_OPTIONS, BLOCO_IP_OPTIONS } from "@/lib/field-options";

const PRODUTO_OPTIONS = [
  "NT LINK DEDICADO FULL", "NT LINK DEDICADO FLEX", "NT LINK EMPRESA",
  "NT LINK IP TRANSITO", "NT EVENTO", "NT PTT", "NT L2L", "NT DARK FIBER",
];
const TECNOLOGIA_OPTIONS = ["GPON", "PTP", "LAST MILE"];
const MEIO_FISICO_OPTIONS = ["Fibra", "Rádio"];

/** Apply CNPJ mask: 00.000.000/0000-00 */
function applyCnpjMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
}

export default function BulkFillModal({ open, onOpenChange, selectedIds }: Props) {
  const { items, updateItems } = useCart();
  const { toast } = useToast();

  const [produto, setProduto] = useState("");
  const [vigencia, setVigencia] = useState("");
  const [taxaInstalacao, setTaxaInstalacao] = useState("");
  const [tecnologia, setTecnologia] = useState("");
  const [meioFisico, setMeioFisico] = useState("");
  const [valorVendido, setValorVendido] = useState("");
  const [velocidade, setVelocidade] = useState("");
  const [tipoSolicitacao, setTipoSolicitacao] = useState("");
  const [blocoIp, setBlocoIp] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [codigoSmark, setCodigoSmark] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const selectedItems = items.filter(i => selectedIds.has(i.id));
  const count = selectedItems.length;

  const getOverwriteCount = () => {
    let c = 0;
    for (const item of selectedItems) {
      if (produto && item.produto && item.produto !== produto) c++;
      if (vigencia && item.vigencia) c++;
      if (taxaInstalacao && item.taxa_instalacao != null) c++;
      if (tecnologia && item.tecnologia && item.tecnologia !== tecnologia) c++;
      if (meioFisico && item.tecnologia_meio_fisico && item.tecnologia_meio_fisico !== meioFisico) c++;
      if (valorVendido && item.valor_a_ser_vendido != null) c++;
      if (velocidade && item.velocidade_mbps != null) c++;
      if (tipoSolicitacao && item.tipo_solicitacao) c++;
      if (blocoIp && item.bloco_ip) c++;
      if (cnpj && item.cnpj_cliente) c++;
      if (codigoSmark && item.codigo_smark) c++;
      if (observacoes && item.observacoes_user) c++;
    }
    return c;
  };

  const overwriteCount = getOverwriteCount();
  const hasAnyValue = produto || vigencia || taxaInstalacao || tecnologia || meioFisico || valorVendido || velocidade || tipoSolicitacao || blocoIp || cnpj || codigoSmark || observacoes;

  const handleApply = () => {
    const ids = Array.from(selectedIds);
    const updates: Record<string, any> = {};
    if (produto) updates.produto = produto;
    if (vigencia) updates.vigencia = vigencia;
    if (taxaInstalacao) updates.taxa_instalacao = parseFloat(taxaInstalacao);
    if (tecnologia) updates.tecnologia = tecnologia;
    if (meioFisico) updates.tecnologia_meio_fisico = meioFisico;
    if (valorVendido) updates.valor_a_ser_vendido = parseFloat(valorVendido);
    if (velocidade) updates.velocidade_mbps = parseFloat(velocidade);
    if (tipoSolicitacao) updates.tipo_solicitacao = tipoSolicitacao;
    if (blocoIp) updates.bloco_ip = blocoIp;
    if (cnpj) updates.cnpj_cliente = cnpj;
    if (codigoSmark) updates.codigo_smark = codigoSmark;
    if (observacoes) updates.observacoes_user = observacoes;

    updateItems(ids, updates);
    toast({ title: `Campos atualizados em ${count} registros com sucesso.` });
    onOpenChange(false);
    resetFields();
  };

  const resetFields = () => {
    setProduto(""); setVigencia(""); setTaxaInstalacao("");
    setTecnologia(""); setMeioFisico(""); setValorVendido("");
    setVelocidade(""); setTipoSolicitacao(""); setBlocoIp("");
    setCnpj(""); setCodigoSmark(""); setObservacoes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preencher em massa</DialogTitle>
          <DialogDescription>
            Preencha os campos desejados para aplicar a {count} registro(s) selecionado(s).
            Campos deixados em branco não serão alterados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Seleção */}
          <div className="space-y-1">
            <Label className="text-xs">Produto</Label>
            <Select value={produto} onValueChange={setProduto}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Não alterar" />
              </SelectTrigger>
              <SelectContent>
                {PRODUTO_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Tecnologia</Label>
            <Select value={tecnologia} onValueChange={setTecnologia}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Não alterar" />
              </SelectTrigger>
              <SelectContent>
                {TECNOLOGIA_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Tecnologia (Meio Físico)</Label>
            <Select value={meioFisico} onValueChange={setMeioFisico}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Não alterar" />
              </SelectTrigger>
              <SelectContent>
                {MEIO_FISICO_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Tipo de Solicitação</Label>
            <Select value={tipoSolicitacao} onValueChange={setTipoSolicitacao}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Não alterar" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_SOLICITACAO_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Vigência</Label>
            <Input className="h-8 text-xs" placeholder="Não alterar" value={vigencia} onChange={e => setVigencia(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Bloco IP</Label>
            <Select value={blocoIp} onValueChange={setBlocoIp}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Não alterar" />
              </SelectTrigger>
              <SelectContent>
                {BLOCO_IP_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Numéricos */}
          <div className="space-y-1">
            <Label className="text-xs">Taxa de Instalação</Label>
            <Input className="h-8 text-xs" type="number" placeholder="Não alterar" value={taxaInstalacao} onChange={e => setTaxaInstalacao(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Valor Vendido</Label>
            <Input className="h-8 text-xs" type="number" placeholder="Não alterar" value={valorVendido} onChange={e => setValorVendido(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Velocidade (Mbps)</Label>
            <Input className="h-8 text-xs" type="number" placeholder="Não alterar" value={velocidade} onChange={e => setVelocidade(e.target.value)} />
          </div>

          {/* Texto */}
          <div className="space-y-1">
            <Label className="text-xs">CNPJ</Label>
            <Input className="h-8 text-xs" placeholder="Não alterar" value={cnpj} onChange={e => setCnpj(applyCnpjMask(e.target.value))} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Cód. Smark</Label>
            <Input className="h-8 text-xs" placeholder="Não alterar" value={codigoSmark} onChange={e => setCodigoSmark(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea className="text-xs min-h-[60px]" placeholder="Não alterar" value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>

          {overwriteCount > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
              ⚠️ {overwriteCount} registro(s) já possuem valores nesses campos e serão sobrescritos.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleApply} disabled={!hasAnyValue}>
            Aplicar a {count} registros
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
