import { useState, useEffect, useRef, useCallback } from "react";
import { PreViabilidade, useUpdatePreViabilidade, useDeletePreViabilidade } from "@/hooks/usePreViabilidades";
import { useAuth } from "@/contexts/AuthContext";
import { useFormPrecificacao, FormState } from "@/hooks/useFormPrecificacao";
import { useCalcularPrecificacao } from "@/hooks/useCalcularPrecificacao";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Calculator, ChevronDown, AlertTriangle, Info, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { VIGENCIA_OPTIONS, BLOCO_IP_OPTIONS, PRODUTO_LINK_OPTIONS, TECNOLOGIA_OPTIONS, MEIO_FISICO_OPTIONS } from "@/lib/field-options";

const PRODUTOS = ["Conectividade", "Firewall", "VOZ", "Switch", "Wifi", "Backup"] as const;

interface Props {
  item: PreViabilidade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

// ── Reusable field components ──

function NumField({ label, value, onChange, disabled, className }: {
  label: string; value: number; onChange: (v: number) => void;
  disabled?: boolean; className?: string;
}) {
  const [display, setDisplay] = useState(String(value).replace(".", ","));

  useEffect(() => {
    setDisplay(String(value).replace(".", ","));
  }, [value]);

  const handleBlur = () => {
    const num = Number(display.replace(",", ".")) || 0;
    onChange(num);
    setDisplay(num.toString().replace(".", ","));
  };

  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="text" inputMode="decimal" disabled={disabled}
        className="h-9 tabular-nums"
        value={disabled ? String(value).replace(".", ",") : display}
        onChange={e => setDisplay(e.target.value.replace(/[^0-9,.\-]/g, ""))}
        onBlur={handleBlur}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder, disabled, className }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; disabled?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9"><SelectValue placeholder={placeholder ?? "Selecione..."} /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

// ── Product-specific field sections ──

function ConectividadeFields({ form, setField, options }: any) {
  const isDarkFiber = form.subproduto === "NT DARK FIBER";
  const isL2L = form.subproduto === "NT L2L";
  const isEvento = form.subproduto === "NT EVENTO";
  const isMudanca = ["Mudança de Endereço", "Mudança de Ponto"].includes(form.motivo);

  return (
    <div className="space-y-4">
      {isMudanca && <Badge variant="secondary" className="gap-1"><Info className="h-3 w-3" /> Custo de banda zerado automaticamente</Badge>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SelectField label="Produto Link IP" value={form.subproduto} onChange={(v: string) => setField("subproduto", v)} options={PRODUTO_LINK_OPTIONS} />
        <NumField label="Distância (m)" value={form.distancia} onChange={(v: number) => setField("distancia", v)} />
        {!isDarkFiber && <NumField label="Velocidade do Link (MB)" value={form.banda} onChange={(v: number) => setField("banda", v)} />}
        {!isL2L && !isDarkFiber && (
          <SelectField label="Bloco IP" value={form.blocoIp} onChange={(v: string) => setField("blocoIp", v)} options={BLOCO_IP_OPTIONS} placeholder="Selecione..." />
        )}
        <SelectField label="Tecnologia" value={form.tecnologia} onChange={(v: string) => setField("tecnologia", v)} options={TECNOLOGIA_OPTIONS} />
        <SelectField label="Tecnologia (Meio Físico)" value={form.tecnologiaMeioFisico} onChange={(v: string) => setField("tecnologiaMeioFisico", v)} options={MEIO_FISICO_OPTIONS} />
        <SelectField label="Cidade Ponta A" value={form.rede} onChange={(v: string) => setField("rede", v)} options={options.redes} placeholder="Selecione a cidade..." />
        {isL2L && <SelectField label="Cidade Ponta B" value={form.redePontaB} onChange={(v: string) => setField("redePontaB", v)} options={options.redes} placeholder="Selecione a cidade..." />}
        {isDarkFiber && <NumField label="Qtd Fibras Dark Fiber" value={form.qtdFibrasDarkFiber} onChange={(v: number) => setField("qtdFibrasDarkFiber", v)} />}
      </div>
      {isEvento && <Badge variant="secondary" className="gap-1"><Info className="h-3 w-3" /> Vigência forçada para 1 mês (NT EVENTO)</Badge>}
    </div>
  );
}

function FirewallFields({ form, setField, options }: any) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SelectField label="Modelo Firewall" value={form.modeloFirewall} onChange={(v: string) => { setField("modeloFirewall", v); setField("marcaFirewall", ""); }} options={options.firewallModelos} />
      <SelectField label="Marca / Licença (ANUAL)" value={form.marcaFirewall} onChange={(v: string) => setField("marcaFirewall", v)} options={options.firewallMarcas} />
      <NumField label="Qtd Equipamentos" value={form.qtdEquipamentos} onChange={(v: number) => setField("qtdEquipamentos", v)} />
    </div>
  );
}

function SwitchFields({ form, setField, options }: any) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SelectField label="Modelo Switch" value={form.modeloSwitch} onChange={(v: string) => setField("modeloSwitch", v)} options={options.switchModelos} />
      <NumField label="Qtd Equipamentos" value={form.qtdEquipamentos} onChange={(v: number) => setField("qtdEquipamentos", v)} />
    </div>
  );
}

function WifiFields({ form, setField, options }: any) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SelectField label="Modelo Wifi" value={form.modeloWifi} onChange={(v: string) => setField("modeloWifi", v)} options={options.wifiModelos} />
      <NumField label="Qtd Equipamentos" value={form.qtdEquipamentos} onChange={(v: number) => setField("qtdEquipamentos", v)} />
    </div>
  );
}

function VozFields({ form, setField, options }: any) {
  return (
    <div className="space-y-3">
      {form.qtdCanais > 50 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Projeto especial — consultar área técnica de Voz</Badge>}
      <CollapsibleSection title="Equipamentos">
        <div className="space-y-3">
          {[1, 2, 3].map(slot => (
            <div key={slot} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField label={`Equipamento ${slot}`} value={form[`equipamentoVoz${slot}`]} onChange={(v: string) => setField(`equipamentoVoz${slot}` as any, v)} options={options.vozEquipamentos} placeholder="Selecione..." />
              <NumField label={`Qtd Equip. ${slot}`} value={form[`qtdEquipamentoVoz${slot}`]} onChange={(v: number) => setField(`qtdEquipamentoVoz${slot}` as any, v)} />
            </div>
          ))}
        </div>
      </CollapsibleSection>
      <Separator />
      <CollapsibleSection title="Ramais e Canais">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Qtd Ramais" value={form.qtdRamais} onChange={(v: number) => setField("qtdRamais", v)} />
          <NumField label="Qtd Canais Simultâneos" value={form.qtdCanais} onChange={(v: number) => setField("qtdCanais", v)} />
        </div>
      </CollapsibleSection>
      <Separator />
      <CollapsibleSection title="Novas Linhas e Portabilidade">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Qtd Novas Linhas" value={form.qtdNovasLinhas} onChange={(v: number) => setField("qtdNovasLinhas", v)} />
          <NumField label="Qtd Portabilidades" value={form.qtdPortabilidades} onChange={(v: number) => setField("qtdPortabilidades", v)} />
        </div>
      </CollapsibleSection>
      <Separator />
      <CollapsibleSection title="Tráfego Fixo">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Min Fixo Local" value={form.minFixoLocal} onChange={(v: number) => setField("minFixoLocal", v)} />
          <NumField label="Min Fixo LDN" value={form.minFixoLDN} onChange={(v: number) => setField("minFixoLDN", v)} />
        </div>
      </CollapsibleSection>
      <Separator />
      <CollapsibleSection title="Tráfego Móvel">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Min Móvel Local" value={form.minMovelLocal} onChange={(v: number) => setField("minMovelLocal", v)} />
          <NumField label="Min Móvel LDN" value={form.minMovelLDN} onChange={(v: number) => setField("minMovelLDN", v)} />
        </div>
      </CollapsibleSection>
      <Separator />
      <CollapsibleSection title="0800">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Min 0800 Móvel" value={form.min0800Movel} onChange={(v: number) => setField("min0800Movel", v)} />
          <NumField label="Min 0800 Fixo" value={form.min0800Fixo} onChange={(v: number) => setField("min0800Fixo", v)} />
        </div>
      </CollapsibleSection>
      <Separator />
      <CollapsibleSection title="Internacional">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField label="País" value={form.paisInternacional} onChange={(v: string) => setField("paisInternacional", v)} options={options.paises} placeholder="Selecione o país..." />
          <NumField label="Min Internacionais" value={form.minInternacional} onChange={(v: number) => setField("minInternacional", v)} />
        </div>
      </CollapsibleSection>
    </div>
  );
}

function BackupFields({ form, setField }: any) {
  return (
    <div className="max-w-xs">
      <NumField label="Qtd TB" value={form.qtdBackupTB} onChange={(v: number) => setField("qtdBackupTB", v)} />
    </div>
  );
}

// ── Main Component ──

export default function PreViabilidadeEditDrawer({ item, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const updateMutation = useUpdatePreViabilidade();
  const deleteMutation = useDeletePreViabilidade();
  const { form: calcForm, setField, setProduto, buildPayload, loadingData, options, getRoiForVigencia } = useFormPrecificacao();
  const { calcular, loading: calculating } = useCalcularPrecificacao();
  const [valorMinimo, setValorMinimo] = useState<number | null>(null);
  const initialLoadDone = useRef(false);

  // Extra editable fields (non-calculator)
  const [meta, setMeta] = useState({
    status: "Aberto",
    nome_cliente: "",
    codigo_smark: "",
    id_guardachuva: "",
    criado_por: "",
    status_aprovacao: "",
    aprovado_por: "",
    projetista: "",
    status_viabilidade: "",
    viabilidade: "",
    tipo_solicitacao: "",
    motivo_solicitacao: "",
    inviabilidade_tecnica: "",
    comentarios_aprovador: "",
    observacao_validacao: "",
    observacoes: "",
  });

  // Initialize valor_minimo from item
  useEffect(() => {
    if (!item) return;
    setValorMinimo(item.valor_minimo ?? null);
    initialLoadDone.current = false;

    // Load calculator state from dados_precificacao
    const dp = item.dados_precificacao || {};
    const produto = (PRODUTOS as readonly string[]).includes(dp.produto) ? dp.produto : "Conectividade";
    setProduto(produto as FormState["produto"]);

    // Apply saved calculator fields after a tick (setProduto resets specific fields)
    setTimeout(() => {
      if (dp.subproduto) setField("subproduto", dp.subproduto);
      if (dp.banda != null) setField("banda", dp.banda);
      if (dp.distancia != null) setField("distancia", dp.distancia);
      if (dp.blocoIp) setField("blocoIp", dp.blocoIp);
      if (dp.tecnologia) setField("tecnologia", dp.tecnologia);
      if (dp.tecnologiaMeioFisico) setField("tecnologiaMeioFisico", dp.tecnologiaMeioFisico);
      if (dp.rede) setField("rede", dp.rede);
      if (dp.redePontaB) setField("redePontaB", dp.redePontaB);
      if (dp.vigencia != null) setField("vigencia", dp.vigencia);
      if (dp.taxaInstalacao != null) setField("taxaInstalacao", dp.taxaInstalacao);
      if (dp.roiVigencia != null) setField("roiVigencia", dp.roiVigencia);
      if (dp.custoLastMile != null) setField("custoLastMile", dp.custoLastMile);
      if (dp.valorLastMile != null) setField("valorLastMile", dp.valorLastMile);
      if (dp.qtdFibrasDarkFiber != null) setField("qtdFibrasDarkFiber", dp.qtdFibrasDarkFiber);
      if (dp.custosMateriaisAdicionais != null) setField("custosMateriaisAdicionais", dp.custosMateriaisAdicionais);
      if (dp.valorOpex != null) setField("valorOpex", dp.valorOpex);
      // Firewall
      if (dp.modeloFirewall) setField("modeloFirewall", dp.modeloFirewall);
      if (dp.marcaFirewall) setField("marcaFirewall", dp.marcaFirewall);
      if (dp.qtdEquipamentos != null) setField("qtdEquipamentos", dp.qtdEquipamentos);
      // Switch / Wifi
      if (dp.modeloSwitch) setField("modeloSwitch", dp.modeloSwitch);
      if (dp.modeloWifi) setField("modeloWifi", dp.modeloWifi);
      // VOZ
      if (dp.equipamentoVoz1) setField("equipamentoVoz1", dp.equipamentoVoz1);
      if (dp.qtdEquipamentoVoz1 != null) setField("qtdEquipamentoVoz1", dp.qtdEquipamentoVoz1);
      if (dp.equipamentoVoz2) setField("equipamentoVoz2", dp.equipamentoVoz2);
      if (dp.qtdEquipamentoVoz2 != null) setField("qtdEquipamentoVoz2", dp.qtdEquipamentoVoz2);
      if (dp.equipamentoVoz3) setField("equipamentoVoz3", dp.equipamentoVoz3);
      if (dp.qtdEquipamentoVoz3 != null) setField("qtdEquipamentoVoz3", dp.qtdEquipamentoVoz3);
      if (dp.qtdRamais != null) setField("qtdRamais", dp.qtdRamais);
      if (dp.qtdCanais != null) setField("qtdCanais", dp.qtdCanais);
      if (dp.qtdNovasLinhas != null) setField("qtdNovasLinhas", dp.qtdNovasLinhas);
      if (dp.qtdPortabilidades != null) setField("qtdPortabilidades", dp.qtdPortabilidades);
      if (dp.minFixoLocal != null) setField("minFixoLocal", dp.minFixoLocal);
      if (dp.minFixoLDN != null) setField("minFixoLDN", dp.minFixoLDN);
      if (dp.minMovelLocal != null) setField("minMovelLocal", dp.minMovelLocal);
      if (dp.minMovelLDN != null) setField("minMovelLDN", dp.minMovelLDN);
      if (dp.min0800Movel != null) setField("min0800Movel", dp.min0800Movel);
      if (dp.min0800Fixo != null) setField("min0800Fixo", dp.min0800Fixo);
      if (dp.paisInternacional) setField("paisInternacional", dp.paisInternacional);
      if (dp.minInternacional != null) setField("minInternacional", dp.minInternacional);
      // Backup
      if (dp.qtdBackupTB != null) setField("qtdBackupTB", dp.qtdBackupTB);
      // Mark initial load will be done after setTimeout fires
      setTimeout(() => { initialLoadDone.current = true; }, 200);
    }, 50);
    // Set meta fields
    setMeta({
      status: item.status || "Aberto",
      nome_cliente: item.nome_cliente || "",
      codigo_smark: item.codigo_smark || "",
      id_guardachuva: item.id_guardachuva || "",
      criado_por: item.criado_por || "",
      status_aprovacao: item.status_aprovacao || "",
      aprovado_por: item.aprovado_por || "",
      projetista: item.projetista || "",
      status_viabilidade: item.status_viabilidade || "",
      viabilidade: item.viabilidade || "",
      tipo_solicitacao: item.tipo_solicitacao || "",
      motivo_solicitacao: item.motivo_solicitacao || "",
      inviabilidade_tecnica: item.inviabilidade_tecnica || "",
      comentarios_aprovador: item.comentarios_aprovador || "",
      observacao_validacao: item.observacao_validacao || "",
      observacoes: item.observacoes || "",
    });
  }, [item]);

  // Auto-recalculate valor_minimo when pricing fields change
  useEffect(() => {
    if (!initialLoadDone.current || !open) return;
    const timer = setTimeout(async () => {
      const payload = buildPayload();
      const result = await calcular(payload);
      if (result?.valorMinimo != null) {
        setValorMinimo(result.valorMinimo);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [calcForm, open, buildPayload, calcular]);

  const setMetaField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setMeta(f => ({ ...f, [field]: e.target.value }));

  // Build dados_precificacao snapshot from current calculator state
  const buildDadosPrecificacao = () => {
    const f = calcForm;
    return {
      produto: f.produto,
      subproduto: f.subproduto,
      vigencia: f.vigencia,
      roiVigencia: f.roiVigencia,
      taxaInstalacao: f.taxaInstalacao,
      custosMateriaisAdicionais: f.custosMateriaisAdicionais,
      valorOpex: f.valorOpex,
      banda: f.banda,
      distancia: f.distancia,
      blocoIp: f.blocoIp,
      custoLastMile: f.custoLastMile,
      valorLastMile: f.valorLastMile,
      qtdFibrasDarkFiber: f.qtdFibrasDarkFiber,
      tecnologia: f.tecnologia,
      tecnologiaMeioFisico: f.tecnologiaMeioFisico,
      rede: f.rede,
      redePontaB: f.redePontaB,
      modeloFirewall: f.modeloFirewall,
      marcaFirewall: f.marcaFirewall,
      qtdEquipamentos: f.qtdEquipamentos,
      modeloSwitch: f.modeloSwitch,
      modeloWifi: f.modeloWifi,
      equipamentoVoz1: f.equipamentoVoz1,
      qtdEquipamentoVoz1: f.qtdEquipamentoVoz1,
      equipamentoVoz2: f.equipamentoVoz2,
      qtdEquipamentoVoz2: f.qtdEquipamentoVoz2,
      equipamentoVoz3: f.equipamentoVoz3,
      qtdEquipamentoVoz3: f.qtdEquipamentoVoz3,
      qtdRamais: f.qtdRamais,
      qtdCanais: f.qtdCanais,
      qtdNovasLinhas: f.qtdNovasLinhas,
      qtdPortabilidades: f.qtdPortabilidades,
      minFixoLocal: f.minFixoLocal,
      minFixoLDN: f.minFixoLDN,
      minMovelLocal: f.minMovelLocal,
      minMovelLDN: f.minMovelLDN,
      min0800Movel: f.min0800Movel,
      min0800Fixo: f.min0800Fixo,
      paisInternacional: f.paisInternacional,
      minInternacional: f.minInternacional,
      qtdBackupTB: f.qtdBackupTB,
    };
  };

  const handleSave = async () => {
    if (!item) return;
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        updates: {
          status: meta.status || null,
          produto_nt: calcForm.produto || null,
          valor_minimo: valorMinimo,
          vigencia: calcForm.vigencia || null,
          nome_cliente: meta.nome_cliente || null,
          tipo_solicitacao: meta.tipo_solicitacao || null,
          viabilidade: meta.viabilidade || null,
          motivo_solicitacao: meta.motivo_solicitacao || null,
          observacoes: meta.observacoes || null,
          codigo_smark: meta.codigo_smark || null,
          id_guardachuva: meta.id_guardachuva || null,
          criado_por: meta.criado_por || null,
          status_aprovacao: meta.status_aprovacao || null,
          aprovado_por: meta.aprovado_por || null,
          projetista: meta.projetista || null,
          status_viabilidade: meta.status_viabilidade || null,
          inviabilidade_tecnica: meta.inviabilidade_tecnica || null,
          comentarios_aprovador: meta.comentarios_aprovador || null,
          observacao_validacao: meta.observacao_validacao || null,
          dados_precificacao: buildDadosPrecificacao(),
        } as any,
      });
      toast({ title: "Registro atualizado com sucesso!" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    }
  };

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!item) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      toast({ title: "Registro excluído com sucesso!" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
    setShowDeleteDialog(false);
  };

  const renderProductFields = () => {
    const props = { form: calcForm, setField, options };
    switch (calcForm.produto) {
      case "Conectividade": return <ConectividadeFields {...props} />;
      case "Firewall": return <FirewallFields {...props} />;
      case "Switch": return <SwitchFields {...props} />;
      case "Wifi": return <WifiFields {...props} />;
      case "VOZ": return <VozFields {...props} />;
      case "Backup": return <BackupFields form={calcForm} setField={setField} />;
      default: return null;
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pré Viabilidade</DialogTitle>
          <DialogDescription>
            #{item.numero || item.id.slice(0, 4).toUpperCase()} — {item.nome_cliente || item.viabilidade || "Registro"}
          </DialogDescription>
        </DialogHeader>

        {/* Valor Mínimo — auto-calculated */}
        <div>
          <Label className="text-xs text-muted-foreground">Valor Mínimo {calculating && "(recalculando...)"}</Label>
          <div className="mt-1 px-3 py-2 rounded-md border border-input bg-muted/50 text-sm min-h-[40px] flex items-center font-semibold">
            {formatCurrency(valorMinimo)}
          </div>
        </div>

        <Separator />

        {/* Meta fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={meta.status} onValueChange={(v) => setMeta(f => ({ ...f, status: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Aberto/Reavaliar">Aberto/Reavaliar</SelectItem>
                <SelectItem value="Fechado">Fechado</SelectItem>
                <SelectItem value="Fechado - Auto Avaliação">Fechado - Auto Avaliação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nome do Cliente</Label>
            <Input className="mt-1" value={meta.nome_cliente} onChange={setMetaField("nome_cliente")} />
          </div>
          <div>
            <Label className="text-xs">Viabilidade</Label>
            <Input className="mt-1" value={meta.viabilidade} onChange={setMetaField("viabilidade")} />
          </div>
          <div>
            <Label className="text-xs">Tipo de Solicitação</Label>
            <Input className="mt-1" value={meta.tipo_solicitacao} onChange={setMetaField("tipo_solicitacao")} />
          </div>
          <div>
            <Label className="text-xs">Código SMARK</Label>
            <Input className="mt-1" value={meta.codigo_smark} onChange={setMetaField("codigo_smark")} />
          </div>
          <div>
            <Label className="text-xs">ID GuardaChuva</Label>
            <Input className="mt-1" value={meta.id_guardachuva} onChange={setMetaField("id_guardachuva")} />
          </div>
          <div>
            <Label className="text-xs">Criado por</Label>
            <Input className="mt-1" value={meta.criado_por} onChange={setMetaField("criado_por")} />
          </div>
          <div>
            <Label className="text-xs">Status Aprovação</Label>
            <Input className="mt-1" value={meta.status_aprovacao} onChange={setMetaField("status_aprovacao")} />
          </div>
          <div>
            <Label className="text-xs">Aprovado por</Label>
            <Input className="mt-1" value={meta.aprovado_por} onChange={setMetaField("aprovado_por")} />
          </div>
          <div>
            <Label className="text-xs">Projetista</Label>
            <Input className="mt-1" value={meta.projetista} onChange={setMetaField("projetista")} />
          </div>
          <div>
            <Label className="text-xs">Status de Viabilidade</Label>
            <Input className="mt-1" value={meta.status_viabilidade} onChange={setMetaField("status_viabilidade")} />
          </div>
        </div>

        <Separator />

        {/* Calculator fields */}
        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Dados de Precificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <SelectField
                    label="Categoria NT"
                    value={calcForm.produto}
                    onChange={v => setProduto(v as FormState["produto"])}
                    options={[...PRODUTOS]}
                  />
                  <SelectField
                    label="Vigência"
                    value={calcForm.subproduto === "NT EVENTO" ? "1" : String(calcForm.vigencia)}
                    onChange={v => {
                      const num = Number(v) || 0;
                      setField("vigencia", num);
                      const roi = getRoiForVigencia(v);
                      if (roi !== null) setField("roiVigencia", roi);
                    }}
                    options={VIGENCIA_OPTIONS}
                    disabled={calcForm.subproduto === "NT EVENTO"}
                  />
                  <NumField
                    label="Taxa de Instalação"
                    value={calcForm.taxaInstalacao}
                    onChange={v => setField("taxaInstalacao", v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Campos — {calcForm.produto}</CardTitle>
              </CardHeader>
              <CardContent>{renderProductFields()}</CardContent>
            </Card>
          </div>
        )}

        <Separator />

        {/* Text areas */}
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Motivo Solicitação</Label>
            <Textarea className="mt-1" rows={2} value={meta.motivo_solicitacao} onChange={setMetaField("motivo_solicitacao")} />
          </div>
          <div>
            <Label className="text-xs">Inviabilidade Técnica</Label>
            <Textarea className="mt-1" rows={2} value={meta.inviabilidade_tecnica} onChange={setMetaField("inviabilidade_tecnica")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Comentários do Aprovador</Label>
              <Textarea className="mt-1" rows={3} value={meta.comentarios_aprovador} onChange={setMetaField("comentarios_aprovador")} />
            </div>
            <div>
              <Label className="text-xs">Observação Validação</Label>
              <Textarea className="mt-1" rows={3} value={meta.observacao_validacao} onChange={setMetaField("observacao_validacao")} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea className="mt-1" rows={14} value={meta.observacoes} onChange={setMetaField("observacoes")} />
          </div>
        </div>

        <div className="flex gap-2 pt-2 justify-between">
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={deleteMutation.isPending} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro #{item?.numero}?</AlertDialogTitle>
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
    </Dialog>
  );
}
