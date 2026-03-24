import { useState, useEffect, useRef, useCallback } from "react";
import { useInsertPreViabilidade, recalcRoiGlobal } from "@/hooks/usePreViabilidades";
import { useAuth } from "@/contexts/AuthContext";
import { useFormPrecificacao, FormState } from "@/hooks/useFormPrecificacao";
import { useCalcularPrecificacao } from "@/hooks/useCalcularPrecificacao";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Calculator, ChevronDown, AlertTriangle, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { VIGENCIA_OPTIONS, BLOCO_IP_OPTIONS, PRODUTO_LINK_OPTIONS, TECNOLOGIA_OPTIONS, MEIO_FISICO_OPTIONS, TIPO_SOLICITACAO_OPTIONS } from "@/lib/field-options";

const PRODUTOS = ["Conectividade", "Firewall", "VOZ", "Switch", "Wifi", "Backup"] as const;

const STEPS = [
  { number: 1, label: "Precificação simples" },
  { number: 2, label: "Dados da solicitação" },
  { number: 3, label: "Validação" },
  { number: 4, label: "BKO" },
];

interface Props {
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
  useEffect(() => { setDisplay(String(value).replace(".", ",")); }, [value]);
  const handleBlur = () => {
    const num = Number(display.replace(",", ".")) || 0;
    onChange(num);
    setDisplay(num.toString().replace(".", ","));
  };
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="text" inputMode="decimal" disabled={disabled} className="h-9 tabular-nums"
        value={disabled ? String(value).replace(".", ",") : display}
        onChange={e => setDisplay(e.target.value.replace(/[^0-9,.\-]/g, ""))}
        onBlur={handleBlur} />
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
  return (
    <div className="space-y-4">
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
      {isEvento && <Badge variant="secondary" className="gap-1"><Info className="h-3 w-3" /> Vigência forçada para 1 mês</Badge>}
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
      {form.qtdCanais > 50 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Projeto especial</Badge>}
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
      <CollapsibleSection title="Tráfego">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Min Fixo Local" value={form.minFixoLocal} onChange={(v: number) => setField("minFixoLocal", v)} />
          <NumField label="Min Fixo LDN" value={form.minFixoLDN} onChange={(v: number) => setField("minFixoLDN", v)} />
          <NumField label="Min Móvel Local" value={form.minMovelLocal} onChange={(v: number) => setField("minMovelLocal", v)} />
          <NumField label="Min Móvel LDN" value={form.minMovelLDN} onChange={(v: number) => setField("minMovelLDN", v)} />
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
  return <div className="max-w-xs"><NumField label="Qtd TB" value={form.qtdBackupTB} onChange={(v: number) => setField("qtdBackupTB", v)} /></div>;
}

// ── Main Component ──
export default function PreViabilidadeCreateDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const insertMutation = useInsertPreViabilidade();
  const { form: calcForm, setField, setProduto, buildPayload, loadingData, options, getRoiForVigencia } = useFormPrecificacao();
  const { calcular, loading: calculating } = useCalcularPrecificacao();
  const [valorMinimo, setValorMinimo] = useState<number | null>(null);
  const [valorCapex, setValorCapex] = useState<number>(0);
  const [step, setStep] = useState(1);
  const initialLoadDone = useRef(false);

  const [meta, setMeta] = useState({
    nome_cliente: "",
    tipo_solicitacao: "",
    ticket_mensal: 0,
    cnpj_cliente: "",
    codigo_smark: "",
    coordenadas: "",
    id_guardachuva: "",
    endereco: "",
    observacoes: "",
    // Step 3 - Validação
    status: "Aberto",
    projetista: "",
    inviabilidade_tecnica: "",
    observacao_validacao: "",
    // Step 4 - BKO
    campanha_comercial: "",
    motivo_solicitacao: "",
    aprovado_por: "",
    status_aprovacao: "",
    criado_por: "",
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setValorMinimo(null);
      setValorCapex(0);
      initialLoadDone.current = false;
      setMeta({
        nome_cliente: "", tipo_solicitacao: "", ticket_mensal: 0,
        cnpj_cliente: "", codigo_smark: "", coordenadas: "",
        id_guardachuva: "", endereco: "", observacoes: "",
        status: "Aberto", projetista: "", inviabilidade_tecnica: "",
        observacao_validacao: "", campanha_comercial: "",
        motivo_solicitacao: "", aprovado_por: "", status_aprovacao: "",
        criado_por: user?.email || "",
      });
      setProduto("Conectividade");
      setTimeout(() => { initialLoadDone.current = true; }, 300);
    }
  }, [open]);

  // Auto-recalculate
  useEffect(() => {
    if (!initialLoadDone.current || !open) return;
    const timer = setTimeout(async () => {
      const payload = buildPayload();
      const result = await calcular(payload);
      if (result?.valorMinimo != null) setValorMinimo(result.valorMinimo);
      if (result?.valorCapex != null) setValorCapex(result.valorCapex);
    }, 600);
    return () => clearTimeout(timer);
  }, [calcForm, open, buildPayload, calcular]);

  const setMetaField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setMeta(f => ({ ...f, [field]: e.target.value }));

  const setMetaNum = (field: string) => (v: number) =>
    setMeta(f => ({ ...f, [field]: v }));

  const buildDadosPrecificacao = () => {
    const f = calcForm;
    return {
      produto: f.produto, subproduto: f.subproduto, vigencia: f.vigencia,
      roiVigencia: f.roiVigencia, taxaInstalacao: f.taxaInstalacao,
      custosMateriaisAdicionais: f.custosMateriaisAdicionais, valorOpex: f.valorOpex,
      banda: f.banda, distancia: f.distancia, blocoIp: f.blocoIp,
      custoLastMile: f.custoLastMile, valorLastMile: f.valorLastMile,
      qtdFibrasDarkFiber: f.qtdFibrasDarkFiber, tecnologia: f.tecnologia,
      tecnologiaMeioFisico: f.tecnologiaMeioFisico, rede: f.rede, redePontaB: f.redePontaB,
      modeloFirewall: f.modeloFirewall, marcaFirewall: f.marcaFirewall,
      qtdEquipamentos: f.qtdEquipamentos, modeloSwitch: f.modeloSwitch, modeloWifi: f.modeloWifi,
      equipamentoVoz1: f.equipamentoVoz1, qtdEquipamentoVoz1: f.qtdEquipamentoVoz1,
      equipamentoVoz2: f.equipamentoVoz2, qtdEquipamentoVoz2: f.qtdEquipamentoVoz2,
      equipamentoVoz3: f.equipamentoVoz3, qtdEquipamentoVoz3: f.qtdEquipamentoVoz3,
      qtdRamais: f.qtdRamais, qtdCanais: f.qtdCanais,
      qtdNovasLinhas: f.qtdNovasLinhas, qtdPortabilidades: f.qtdPortabilidades,
      minFixoLocal: f.minFixoLocal, minFixoLDN: f.minFixoLDN,
      minMovelLocal: f.minMovelLocal, minMovelLDN: f.minMovelLDN,
      min0800Movel: f.min0800Movel, min0800Fixo: f.min0800Fixo,
      paisInternacional: f.paisInternacional, minInternacional: f.minInternacional,
      qtdBackupTB: f.qtdBackupTB,
      valorCapex,
      media_mensalidade_lm: 0, custo_radio: 0, valor_total_reais: 0,
      usou_finder2: 0, campanha_comercial_meses: 0,
    };
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      await insertMutation.mutateAsync([{
        user_id: user.id,
        numero: 0, // will be auto-generated
        status: meta.status || "Aberto",
        produto_nt: calcForm.produto || null,
        valor_minimo: valorMinimo,
        vigencia: calcForm.vigencia || null,
        nome_cliente: meta.nome_cliente || null,
        tipo_solicitacao: meta.tipo_solicitacao || null,
        ticket_mensal: meta.ticket_mensal || null,
        motivo_solicitacao: meta.motivo_solicitacao || null,
        observacoes: meta.observacoes || null,
        codigo_smark: meta.codigo_smark || null,
        id_guardachuva: meta.id_guardachuva || null,
        criado_por: meta.criado_por || user.email || null,
        status_aprovacao: meta.status_aprovacao || null,
        aprovado_por: meta.aprovado_por || null,
        projetista: meta.projetista || null,
        inviabilidade_tecnica: meta.inviabilidade_tecnica || null,
        observacao_validacao: meta.observacao_validacao || null,
        modificado_por: user.email || null,
        dados_precificacao: buildDadosPrecificacao(),
        viabilidade: null,
        status_viabilidade: null,
        previsao_roi: null,
        roi_global: null,
        comentarios_aprovador: null,
        origem: "manual",
      } as any]);

      if (meta.id_guardachuva) {
        await recalcRoiGlobal(meta.id_guardachuva);
      }

      toast({ title: "Pré Viabilidade criada com sucesso!" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao criar", description: e.message, variant: "destructive" });
    }
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

  const renderStep1 = () => (
    <div className="space-y-4">
      {loadingData ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SelectField label="Categoria NT" value={calcForm.produto}
              onChange={v => setProduto(v as FormState["produto"])} options={[...PRODUTOS]} />
            <SelectField label="Vigência"
              value={calcForm.subproduto === "NT EVENTO" ? "1" : String(calcForm.vigencia)}
              onChange={v => {
                const num = Number(v) || 0;
                setField("vigencia", num);
                const roi = getRoiForVigencia(v);
                if (roi !== null) setField("roiVigencia", roi);
              }}
              options={VIGENCIA_OPTIONS}
              disabled={calcForm.subproduto === "NT EVENTO"} />
            <NumField label="Taxa de Instalação" value={calcForm.taxaInstalacao}
              onChange={v => setField("taxaInstalacao", v)} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Campos — {calcForm.produto}</CardTitle>
            </CardHeader>
            <CardContent>{renderProductFields()}</CardContent>
          </Card>

        </>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Nome do Cliente</Label>
          <Input className="h-9 mt-1" value={meta.nome_cliente} onChange={setMetaField("nome_cliente")} />
        </div>
        <SelectField label="Tipo de Solicitação" value={meta.tipo_solicitacao}
          onChange={v => setMeta(f => ({ ...f, tipo_solicitacao: v }))} options={TIPO_SOLICITACAO_OPTIONS} />
        <NumField label="Valor Vendido (Ticket Mensal)" value={meta.ticket_mensal}
          onChange={setMetaNum("ticket_mensal")} />
        <div>
          <Label className="text-xs text-muted-foreground">CNPJ Cliente</Label>
          <Input className="h-9 mt-1" value={meta.cnpj_cliente} onChange={setMetaField("cnpj_cliente")} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Código Oportunidade SMARK</Label>
          <Input className="h-9 mt-1" value={meta.codigo_smark} onChange={setMetaField("codigo_smark")} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Coordenadas</Label>
          <Input className="h-9 mt-1" value={meta.coordenadas} onChange={setMetaField("coordenadas")} placeholder="Ex: -23.5505, -46.6333" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">ID GuardaChuva</Label>
          <Input className="h-9 mt-1" value={meta.id_guardachuva} onChange={setMetaField("id_guardachuva")} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label className="text-xs text-muted-foreground">Endereço</Label>
          <Input className="h-9 mt-1" value={meta.endereco} onChange={setMetaField("endereco")} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label className="text-xs text-muted-foreground">Observações</Label>
          <Textarea className="mt-1" rows={4} value={meta.observacoes} onChange={setMetaField("observacoes")} />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SelectField label="Status" value={meta.status}
          onChange={v => setMeta(f => ({ ...f, status: v }))}
          options={["Aberto", "Aberto/Reavaliar", "Fechado", "Fechado - Auto Avaliação"]} />
        <div>
          <Label className="text-xs text-muted-foreground">OPEX</Label>
          <Input className="h-9 mt-1 bg-muted/50" value={formatCurrency(calcForm.valorOpex)} disabled />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">CAPEX</Label>
          <Input className="h-9 mt-1 bg-muted/50" value={formatCurrency(valorCapex)} disabled />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Projetista</Label>
          <Input className="h-9 mt-1" value={meta.projetista} onChange={setMetaField("projetista")} />
        </div>
        <NumField label="Lançamento e custo materiais" value={calcForm.custosMateriaisAdicionais}
          onChange={v => setField("custosMateriaisAdicionais", v)} />
        <div>
          <Label className="text-xs text-muted-foreground">Inviabilidade Técnica</Label>
          <Input className="h-9 mt-1" value={meta.inviabilidade_tecnica} onChange={setMetaField("inviabilidade_tecnica")} />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Observação Validação</Label>
        <Textarea className="mt-1" rows={4} value={meta.observacao_validacao} onChange={setMetaField("observacao_validacao")} />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Campanha Comercial</Label>
          <Input className="h-9 mt-1" value={meta.campanha_comercial} onChange={setMetaField("campanha_comercial")} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Motivo Solicitação</Label>
          <Input className="h-9 mt-1" value={meta.motivo_solicitacao} onChange={setMetaField("motivo_solicitacao")} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Aprovado por</Label>
          <Input className="h-9 mt-1" value={meta.aprovado_por} onChange={setMetaField("aprovado_por")} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status Aprovação</Label>
          <Input className="h-9 mt-1" value={meta.status_aprovacao} onChange={setMetaField("status_aprovacao")} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Criado por</Label>
          <Input className="h-9 mt-1" value={meta.criado_por} onChange={setMetaField("criado_por")} />
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Pré Viabilidade</DialogTitle>
          <DialogDescription>Preencha os dados para criar um novo registro de pré viabilidade</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 py-2">
          {STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center gap-1">
              <button
                onClick={() => setStep(s.number)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  step === s.number
                    ? "bg-primary text-primary-foreground"
                    : step > s.number
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-current">
                  {s.number}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
            </div>
          ))}
        </div>

        <Separator />

        {/* Step content */}
        <div className="min-h-[300px]">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {/* Valor Mínimo footer */}
        <div className="rounded-md border border-input bg-muted/30 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Valor Mínimo: <span className="font-semibold text-foreground">{formatCurrency(valorMinimo)}</span>
          </span>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
            className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>
          <div className="flex gap-2">
            {step < 4 && (
              <Button onClick={() => setStep(step + 1)} className="gap-2">
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <Button onClick={handleSave} disabled={insertMutation.isPending} className="gap-2"
              variant={step === 4 ? "default" : "outline"}>
              {insertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
