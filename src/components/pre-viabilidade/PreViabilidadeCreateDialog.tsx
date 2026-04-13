import React, { useState, useEffect, useRef, useCallback } from "react";
import { useInsertPreViabilidade, recalcRoiGlobal, calculateIndividualROI } from "@/hooks/usePreViabilidades";
import { useUserRole } from "@/hooks/useUserRole";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { VIGENCIA_OPTIONS, BLOCO_IP_OPTIONS, PRODUTO_LINK_OPTIONS, TECNOLOGIA_OPTIONS, MEIO_FISICO_OPTIONS, TIPO_SOLICITACAO_OPTIONS } from "@/lib/field-options";
import { supabase } from "@/integrations/supabase/client";

const PRODUTOS = ["Conectividade", "Firewall", "VOZ", "Switch", "Wifi", "Backup"] as const;

const STEPS = [
  { number: 1, label: "Precificação simples" },
  { number: 2, label: "Dados da solicitação" },
  { number: 3, label: "Validação" },
  { number: 4, label: "BKO" },
];

export interface PreViabilidadeInitialData {
  subproduto?: string;
  distancia?: number;
  banda?: number;
  vigencia?: number;
  taxaInstalacao?: number;
  tecnologia?: string;
  blocoIp?: string;
  rede?: string;
  redePontaB?: string;
  qtdFibrasDarkFiber?: number;
  nome_cliente?: string;
  endereco?: string;
  coordenadas?: string;
  observacoes?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: PreViabilidadeInitialData;
}

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

// ── Reusable field components ──
function NumField({ label, value, onChange, disabled, className, required }: {
  label: string; value: number; onChange: (v: number) => void;
  disabled?: boolean; className?: string; required?: boolean;
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
      <Label className="text-xs text-muted-foreground">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Input type="text" inputMode="decimal" disabled={disabled} className="h-9 tabular-nums"
        value={disabled ? String(value).replace(".", ",") : display}
        onChange={e => setDisplay(e.target.value.replace(/[^0-9,.\-]/g, ""))}
        onBlur={handleBlur} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder, disabled, className, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; disabled?: boolean; className?: string; required?: boolean;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9"><SelectValue placeholder={placeholder ?? "Selecione..."} /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
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
        <SelectField label="Produto Link IP" value={form.subproduto} onChange={(v: string) => setField("subproduto", v)} options={PRODUTO_LINK_OPTIONS} required />
        <NumField label="Distância (m)" value={form.distancia} onChange={(v: number) => setField("distancia", v)} />
        {!isDarkFiber && <NumField label="Velocidade do Link (MB)" value={form.banda} onChange={(v: number) => setField("banda", v)} required />}
        {!isL2L && !isDarkFiber && (
          <SelectField label="Bloco IP" value={form.blocoIp} onChange={(v: string) => setField("blocoIp", v)} options={BLOCO_IP_OPTIONS} placeholder="Selecione..." />
        )}
        <SelectField label="Tecnologia" value={form.tecnologia} onChange={(v: string) => setField("tecnologia", v)} options={TECNOLOGIA_OPTIONS} required />
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
      <SelectField label="Firewall Equipamento" value={form.modeloFirewall} onChange={(v: string) => { setField("modeloFirewall", v); setField("firewallSolucao", ""); }} options={options.firewallModelos} />
      <SelectField label="Firewall Solução" value={form.firewallSolucao} onChange={(v: string) => setField("firewallSolucao", v)} options={options.firewallSolucoes} />
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
    <div className="space-y-4">
      {form.qtdCanais > 50 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Projeto especial</Badge>}
      <SectionLabel>Equipamentos</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(slot => (
          <React.Fragment key={slot}>
            <SelectField label={`Equipamento ${slot}`} value={form[`equipamentoVoz${slot}`]} onChange={(v: string) => setField(`equipamentoVoz${slot}` as any, v)} options={options.vozEquipamentos} placeholder="Selecione..." />
            <NumField label={`Qtd Equip. ${slot}`} value={form[`qtdEquipamentoVoz${slot}`]} onChange={(v: number) => setField(`qtdEquipamentoVoz${slot}` as any, v)} />
          </React.Fragment>
        ))}
      </div>
      <SectionLabel>Ramais e Canais</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NumField label="Qtd Ramais" value={form.qtdRamais} onChange={(v: number) => setField("qtdRamais", v)} />
        <NumField label="Qtd Canais Simultâneos" value={form.qtdCanais} onChange={(v: number) => setField("qtdCanais", v)} />
      </div>
      <SectionLabel>Tráfego</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NumField label="Min Fixo Local" value={form.minFixoLocal} onChange={(v: number) => setField("minFixoLocal", v)} />
        <NumField label="Min Fixo LDN" value={form.minFixoLDN} onChange={(v: number) => setField("minFixoLDN", v)} />
        <NumField label="Min Móvel Local" value={form.minMovelLocal} onChange={(v: number) => setField("minMovelLocal", v)} />
        <NumField label="Min Móvel LDN" value={form.minMovelLDN} onChange={(v: number) => setField("minMovelLDN", v)} />
        <NumField label="Min 0800 Móvel" value={form.min0800Movel} onChange={(v: number) => setField("min0800Movel", v)} />
        <NumField label="Min 0800 Fixo" value={form.min0800Fixo} onChange={(v: number) => setField("min0800Fixo", v)} />
      </div>
      <SectionLabel>Internacional</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SelectField label="País" value={form.paisInternacional} onChange={(v: string) => setField("paisInternacional", v)} options={options.paises} placeholder="Selecione o país..." />
        <NumField label="Min Internacionais" value={form.minInternacional} onChange={(v: number) => setField("minInternacional", v)} />
      </div>
    </div>
  );
}

function BackupFields({ form, setField }: any) {
  return <div className="max-w-xs"><NumField label="Qtd TB" value={form.qtdBackupTB} onChange={(v: number) => setField("qtdBackupTB", v)} /></div>;
}

// ── Main Component ──
export default function PreViabilidadeCreateDialog({ open, onOpenChange, initialData }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const insertMutation = useInsertPreViabilidade();
  const { form: calcForm, setField, setProduto, buildPayload, loadingData, options, getRoiForVigencia } = useFormPrecificacao();
  const { calcular, loading: calculating } = useCalcularPrecificacao();
  const [valorMinimo, setValorMinimo] = useState<number | null>(null);
  const [valorCapex, setValorCapex] = useState<number>(0);
  const [step, setStep] = useState(1);
  const initialLoadDone = useRef(false);
  const [projetistaOptions, setProjetistaOptions] = useState<string[]>([]);

  // Load projetista options from configuracoes
  useEffect(() => {
    supabase.from("configuracoes").select("valor").eq("chave", "projetistas").single()
      .then(({ data }) => {
        if (data?.valor && Array.isArray(data.valor)) setProjetistaOptions(data.valor as string[]);
      });
  }, []);

  const [meta, setMeta] = useState({
    nome_cliente: "",
    tipo_solicitacao: "Nova Ativação",
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
    data_reavaliacao: "",
    media_mensalidade_lm: 0,
    // Step 4 - BKO
    campanha_comercial: "",
    motivo_solicitacao: "",
    aprovado_por: "",
    status_aprovacao: "",
    criado_por: "",
    protocolo: "",
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setValorMinimo(null);
      setValorCapex(0);
      initialLoadDone.current = false;
      setMeta({
        nome_cliente: initialData?.nome_cliente || "",
        tipo_solicitacao: "Nova Ativação", ticket_mensal: 0,
        cnpj_cliente: "", codigo_smark: "",
        coordenadas: initialData?.coordenadas || "",
        id_guardachuva: "",
        endereco: initialData?.endereco || "",
        observacoes: initialData?.observacoes || "",
        status: "Aberto", projetista: "", inviabilidade_tecnica: "",
        observacao_validacao: "", data_reavaliacao: "", media_mensalidade_lm: 0, campanha_comercial: "",
        motivo_solicitacao: "", aprovado_por: "", status_aprovacao: "",
        criado_por: user?.email || "", protocolo: "",
      });
      setProduto("Conectividade");

      // Apply initialData to pricing form after a tick so setProduto settles
      if (initialData) {
        setTimeout(() => {
          if (initialData.subproduto) setField("subproduto", initialData.subproduto);
          if (initialData.distancia != null) setField("distancia", initialData.distancia);
          if (initialData.banda != null) setField("banda", initialData.banda);
          if (initialData.vigencia != null) {
            setField("vigencia", initialData.vigencia);
            const roi = getRoiForVigencia(String(initialData.vigencia));
            if (roi !== null) setField("roiVigencia", roi);
          }
          if (initialData.taxaInstalacao != null) setField("taxaInstalacao", initialData.taxaInstalacao);
          if (initialData.tecnologia) setField("tecnologia", initialData.tecnologia);
          if (initialData.blocoIp) setField("blocoIp", initialData.blocoIp);
          if (initialData.rede) setField("rede", initialData.rede);
          if (initialData.redePontaB) setField("redePontaB", initialData.redePontaB);
          if (initialData.qtdFibrasDarkFiber != null) setField("qtdFibrasDarkFiber", initialData.qtdFibrasDarkFiber);
          initialLoadDone.current = true;
        }, 100);
      } else {
        setTimeout(() => { initialLoadDone.current = true; }, 300);
      }
    }
  }, [open]);

  // Auto-recalculate
  useEffect(() => {
    if (!initialLoadDone.current || !open) return;
    const timer = setTimeout(async () => {
      const payload = buildPayload();
      if (calcForm.tecnologia === "LAST MILE" && meta.media_mensalidade_lm) {
        (payload as any).valorLastMile = meta.media_mensalidade_lm;
      }
      const result = await calcular(payload);
      if (result?.valorMinimo != null) setValorMinimo(result.valorMinimo);
      if (result?.valorCapex != null) setValorCapex(result.valorCapex);
    }, 600);
    return () => clearTimeout(timer);
  }, [calcForm, open, buildPayload, calcular, meta.media_mensalidade_lm]);

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
      modeloFirewall: f.modeloFirewall, firewallSolucao: f.firewallSolucao,
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
      media_mensalidade_lm: meta.media_mensalidade_lm || 0, custo_radio: 0, valor_total_reais: 0,
      usou_finder2: 0, campanha_comercial_meses: parseFloat(meta.campanha_comercial) || 0,
    };
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!calcForm.produto) return "Categoria NT é obrigatória";
      if (!calcForm.vigencia && calcForm.subproduto !== "NT EVENTO") return "Vigência é obrigatória";
      if (calcForm.produto === "Conectividade") {
        if (!calcForm.subproduto) return "Produto Link IP é obrigatório";
        if (calcForm.subproduto !== "NT DARK FIBER" && !calcForm.banda) return "Velocidade MB é obrigatória";
        if (!calcForm.tecnologia) return "Tecnologia é obrigatória";
      }
    }
    if (s === 2) {
      if (!meta.nome_cliente.trim()) return "Nome do Cliente é obrigatório";
      if (!meta.tipo_solicitacao) return "Tipo de Solicitação é obrigatório";
      if (!meta.ticket_mensal) return "Valor Vendido é obrigatório";
      if (!meta.endereco.trim()) return "Endereço é obrigatório";
    }
    return null;
  };

  const handleSave = async () => {
    if (!user) return;
    // Validate all steps
    for (let s = 1; s <= 4; s++) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        toast({ title: "Campo obrigatório", description: err, variant: "destructive" });
        return;
      }
    }
    try {
      await insertMutation.mutateAsync([{
        user_id: user.id,
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
        cnpj_cliente: meta.cnpj_cliente || null,
        coordenadas: meta.coordenadas || null,
        endereco: meta.endereco || null,
        protocolo: meta.protocolo || null,
        dados_precificacao: buildDadosPrecificacao(),
        data_reavaliacao: meta.data_reavaliacao || null,
        viabilidade: null,
        status_viabilidade: null,
        previsao_roi: calculateIndividualROI(meta.ticket_mensal, buildDadosPrecificacao()),
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

  const handleNext = () => {
    const err = validateStep(step);
    if (err) {
      toast({ title: "Campo obrigatório", description: err, variant: "destructive" });
      return;
    }
    setStep(step + 1);
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
            <SelectField label="Categoria NT" value={calcForm.produto} required
              onChange={v => setProduto(v as FormState["produto"])} options={[...PRODUTOS]} />
            <SelectField label="Vigência" required
              value={calcForm.subproduto === "NT EVENTO" ? "1" : String(calcForm.vigencia)}
              onChange={v => {
                const num = Number(v) || 0;
                setField("vigencia", num);
                const roi = getRoiForVigencia(v);
                if (roi !== null) setField("roiVigencia", roi);
              }}
              options={VIGENCIA_OPTIONS}
              disabled={calcForm.subproduto === "NT EVENTO"} />
            <NumField label="Taxa de Instalação" value={calcForm.taxaInstalacao} required
              onChange={v => setField("taxaInstalacao", v)} />
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Campos — {calcForm.produto}</p>
            {renderProductFields()}
          </div>

        </>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Nome do Cliente<span className="text-destructive ml-0.5">*</span></Label>
          <Input className="h-9 mt-1" value={meta.nome_cliente} onChange={setMetaField("nome_cliente")} />
        </div>
        <SelectField label="Tipo de Solicitação" value={meta.tipo_solicitacao} required
          onChange={v => setMeta(f => ({ ...f, tipo_solicitacao: v }))} options={TIPO_SOLICITACAO_OPTIONS} />
        <NumField label="Valor Vendido (Ticket Mensal)" value={meta.ticket_mensal} required
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
          <Label className="text-xs text-muted-foreground">Endereço<span className="text-destructive ml-0.5">*</span></Label>
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
        <NumField label="OPEX" value={calcForm.valorOpex}
          onChange={v => setField("valorOpex", v)} />
        <div>
          <Label className="text-xs text-muted-foreground">CAPEX</Label>
          <Input className="h-9 mt-1 bg-muted/50" value={formatCurrency(valorCapex)} disabled />
        </div>
        {projetistaOptions.length > 0 ? (
          <SelectField label="Projetista" value={meta.projetista}
            onChange={v => setMeta(f => ({ ...f, projetista: v }))} options={projetistaOptions} placeholder="Selecione..." />
        ) : (
          <div>
            <Label className="text-xs text-muted-foreground">Projetista</Label>
            <Input className="h-9 mt-1" value={meta.projetista} onChange={setMetaField("projetista")} />
          </div>
        )}
        <NumField label="Lançamento e custo materiais" value={calcForm.custosMateriaisAdicionais}
          onChange={v => setField("custosMateriaisAdicionais", v)} />
        {calcForm.tecnologia === "LAST MILE" && (
          <NumField label="Média Mensalidade LM" value={meta.media_mensalidade_lm}
            onChange={setMetaNum("media_mensalidade_lm")} />
        )}
        <div>
          <Label className="text-xs text-muted-foreground">Inviabilidade Técnica</Label>
          <Input className="h-9 mt-1" value={meta.inviabilidade_tecnica} onChange={setMetaField("inviabilidade_tecnica")} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Data de Reavaliação</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-9 mt-1 w-full justify-start text-left font-normal", !meta.data_reavaliacao && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {meta.data_reavaliacao ? format(new Date(meta.data_reavaliacao), "dd/MM/yyyy") : "Selecione..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" className="p-3 pointer-events-auto"
                selected={meta.data_reavaliacao ? new Date(meta.data_reavaliacao) : undefined}
                onSelect={d => setMeta(f => ({ ...f, data_reavaliacao: d ? format(d, "yyyy-MM-dd") : "" }))} />
            </PopoverContent>
          </Popover>
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
          <Input className="h-9 mt-1" value={meta.criado_por} readOnly disabled />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Protocolo</Label>
          <Input className="h-9 mt-1" value={meta.protocolo} onChange={setMetaField("protocolo")} />
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

        {/* Step indicator + Valor Mínimo */}
        <div className="rounded-lg bg-muted/40 border p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.number} className="flex items-center">
                <button
                  onClick={() => setStep(s.number)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                    step === s.number
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : step > s.number
                        ? "text-primary hover:bg-primary/10"
                        : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors",
                    step === s.number
                      ? "bg-primary-foreground/20"
                      : step > s.number
                        ? "bg-primary/20 text-primary"
                        : "bg-muted-foreground/20"
                  )}>
                    {step > s.number ? "✓" : s.number}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-background border px-4 py-2 shadow-sm">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Valor Mínimo</span>
            <span className="text-sm font-bold text-foreground">{formatCurrency(valorMinimo)}</span>
          </div>
        </div>

        {/* Step content */}
        <div className="min-h-[300px] pt-2">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {/* Navigation */}
        <Separator />
        <div className="flex justify-between pt-1">
          <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
            className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>
          <div className="flex gap-2">
            {step < 4 && (
              <Button onClick={handleNext} className="gap-2">
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
