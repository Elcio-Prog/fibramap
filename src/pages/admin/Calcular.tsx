import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useFormPrecificacao, FormState } from "@/hooks/useFormPrecificacao";
import { useCalcularPrecificacao } from "@/hooks/useCalcularPrecificacao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Calculator, ChevronDown, AlertTriangle, Info, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { VIGENCIA_OPTIONS, BLOCO_IP_OPTIONS, TIPO_SOLICITACAO_OPTIONS, PRODUTO_LINK_OPTIONS, TECNOLOGIA_OPTIONS, MEIO_FISICO_OPTIONS } from "@/lib/field-options";

const PRODUTOS = ["Conectividade", "Firewall", "VOZ", "Switch", "Wifi", "Backup"] as const;

function formatBRL(v: number, decimais = 2) {
  return v.toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: decimais, maximumFractionDigits: decimais,
  });
}

function NumField({
  label, value, onChange, disabled, className,
}: {
  label: string; value: number; onChange: (v: number) => void;
  disabled?: boolean; className?: string;
}) {
  const [display, setDisplay] = useState(String(value).replace(".", ","));

  const handleBlur = () => {
    const num = Number(display.replace(",", ".")) || 0;
    onChange(num);
    setDisplay(num.toString().replace(".", ","));
  };

  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        className="h-9 tabular-nums"
        value={disabled ? String(value).replace(".", ",") : display}
        onChange={e => {
          const raw = e.target.value.replace(/[^0-9,.\-]/g, "");
          setDisplay(raw);
        }}
        onBlur={handleBlur}
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options, placeholder, disabled, className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; disabled?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder={placeholder ?? "Selecione..."} />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
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
      <CollapsibleContent className="pt-2 pb-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Product-specific sections ──

function ConectividadeFields({ form, setField, options }: {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  options: ReturnType<typeof useFormPrecificacao>["options"];
}) {
  const isDarkFiber = form.subproduto === "NT DARK FIBER";
  const isL2L = form.subproduto === "NT L2L";
  const isEvento = form.subproduto === "NT EVENTO";
  const isMudanca = ["Mudança de Endereço", "Mudança de Ponto"].includes(form.motivo);

  return (
    <div className="space-y-4">
      {isMudanca && (
        <Badge variant="secondary" className="gap-1">
          <Info className="h-3 w-3" /> Custo de banda zerado automaticamente
        </Badge>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SelectField
          label="Produto Link IP"
          value={form.subproduto}
          onChange={v => setField("subproduto", v)}
          options={PRODUTO_LINK_OPTIONS}
        />
        <NumField label="Distância (m)" value={form.distancia} onChange={v => setField("distancia", v)} />
        {!isDarkFiber && (
          <NumField label="Velocidade do Link (MB)" value={form.banda} onChange={v => setField("banda", v)} />
        )}
        {!isL2L && !isDarkFiber && (
          <SelectField
            label="Bloco IP"
            value={form.blocoIp}
            onChange={v => setField("blocoIp", v)}
            options={BLOCO_IP_OPTIONS}
            placeholder="Selecione..."
          />
        )}
        <SelectField
          label="Tecnologia"
          value={form.tecnologia}
          onChange={v => setField("tecnologia", v)}
          options={TECNOLOGIA_OPTIONS}
        />
        <SelectField
          label="Tecnologia (Meio Físico)"
          value={form.tecnologiaMeioFisico}
          onChange={v => setField("tecnologiaMeioFisico", v)}
          options={MEIO_FISICO_OPTIONS}
        />
        <SelectField
          label="Cidade Ponta A"
          value={form.rede}
          onChange={v => setField("rede", v)}
          options={options.redes}
          placeholder="Selecione a cidade..."
        />
        {isL2L && (
          <SelectField
            label="Cidade Ponta B"
            value={form.redePontaB}
            onChange={v => setField("redePontaB", v)}
            options={options.redes}
            placeholder="Selecione a cidade..."
          />
        )}
        {isDarkFiber && (
          <NumField label="Qtd Fibras Dark Fiber" value={form.qtdFibrasDarkFiber} onChange={v => setField("qtdFibrasDarkFiber", v)} />
        )}
      </div>

      {isEvento && (
        <Badge variant="secondary" className="gap-1">
          <Info className="h-3 w-3" /> Vigência forçada para 1 mês (NT EVENTO)
        </Badge>
      )}
    </div>
  );
}

function FirewallFields({ form, setField, options }: {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  options: ReturnType<typeof useFormPrecificacao>["options"];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SelectField
        label="Modelo Firewall"
        value={form.modeloFirewall}
        onChange={v => { setField("modeloFirewall", v); setField("firewallSolucao", ""); }}
        options={options.firewallModelos}
      />
      <SelectField
        label="Firewall Solução"
        value={form.firewallSolucao}
        onChange={v => setField("firewallSolucao", v)}
        options={options.firewallSolucoes}
      />
      <NumField label="Qtd Equipamentos" value={form.qtdEquipamentos} onChange={v => setField("qtdEquipamentos", v)} />
    </div>
  );
}

function SwitchFields({ form, setField, options }: {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  options: ReturnType<typeof useFormPrecificacao>["options"];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SelectField
        label="Modelo Switch"
        value={form.modeloSwitch}
        onChange={v => setField("modeloSwitch", v)}
        options={options.switchModelos}
      />
      <NumField label="Qtd Equipamentos" value={form.qtdEquipamentos} onChange={v => setField("qtdEquipamentos", v)} />
    </div>
  );
}

function WifiFields({ form, setField, options }: {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  options: ReturnType<typeof useFormPrecificacao>["options"];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SelectField
        label="Modelo Wifi"
        value={form.modeloWifi}
        onChange={v => setField("modeloWifi", v)}
        options={options.wifiModelos}
      />
      <NumField label="Qtd Equipamentos" value={form.qtdEquipamentos} onChange={v => setField("qtdEquipamentos", v)} />
    </div>
  );
}

function VozFields({ form, setField, options }: {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  options: ReturnType<typeof useFormPrecificacao>["options"];
}) {
  return (
    <div className="space-y-3">
      {form.qtdCanais > 50 && (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" /> Projeto especial — consultar área técnica de Voz
        </Badge>
      )}

      <CollapsibleSection title="Equipamentos">
        <div className="space-y-3">
          {[1, 2, 3].map(slot => {
            const eqKey = `equipamentoVoz${slot}` as keyof FormState;
            const qtdKey = `qtdEquipamentoVoz${slot}` as keyof FormState;
            return (
              <div key={slot} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SelectField
                  label={`Equipamento ${slot}`}
                  value={form[eqKey] as string}
                  onChange={v => setField(eqKey, v as never)}
                  options={options.vozEquipamentos}
                  placeholder="Selecione..."
                />
                <NumField
                  label={`Qtd Equip. ${slot}`}
                  value={form[qtdKey] as number}
                  onChange={v => setField(qtdKey, v as never)}
                />
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="Ramais e Canais">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Qtd Ramais" value={form.qtdRamais} onChange={v => setField("qtdRamais", v)} />
          <NumField label="Qtd Canais Simultâneos" value={form.qtdCanais} onChange={v => setField("qtdCanais", v)} />
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="Novas Linhas e Portabilidade">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Qtd Novas Linhas" value={form.qtdNovasLinhas} onChange={v => setField("qtdNovasLinhas", v)} />
          <NumField label="Qtd Portabilidades" value={form.qtdPortabilidades} onChange={v => setField("qtdPortabilidades", v)} />
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="Tráfego Fixo">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Min Fixo Local" value={form.minFixoLocal} onChange={v => setField("minFixoLocal", v)} />
          <NumField label="Min Fixo LDN" value={form.minFixoLDN} onChange={v => setField("minFixoLDN", v)} />
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="Tráfego Móvel">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Min Móvel Local" value={form.minMovelLocal} onChange={v => setField("minMovelLocal", v)} />
          <NumField label="Min Móvel LDN" value={form.minMovelLDN} onChange={v => setField("minMovelLDN", v)} />
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="0800">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Min 0800 Móvel" value={form.min0800Movel} onChange={v => setField("min0800Movel", v)} />
          <NumField label="Min 0800 Fixo" value={form.min0800Fixo} onChange={v => setField("min0800Fixo", v)} />
        </div>
      </CollapsibleSection>

      <Separator />

      <CollapsibleSection title="Internacional">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label="País"
            value={form.paisInternacional}
            onChange={v => setField("paisInternacional", v)}
            options={options.paises}
            placeholder="Selecione o país..."
          />
          <NumField label="Min Internacionais" value={form.minInternacional} onChange={v => setField("minInternacional", v)} />
        </div>
      </CollapsibleSection>
    </div>
  );
}

function BackupFields({ form, setField }: {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <div className="max-w-xs">
      <NumField label="Qtd TB" value={form.qtdBackupTB} onChange={v => setField("qtdBackupTB", v)} />
    </div>
  );
}

// ── Result Sidebar ──

function ResultPanel({ resultado, calculating, error }: {
  resultado: { valorMinimo: number; valorCapex: number; valorOpex: number; mensagem?: string } | null;
  calculating: boolean;
  error: string | null;
}) {
  return (
    <div className="lg:sticky lg:top-6 space-y-4">
      <Card className={
        resultado?.mensagem
          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20"
          : resultado
            ? "border-primary/30"
            : ""
      }>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Resultado
            {calculating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!resultado && !error && !calculating && (
            <p className="text-sm text-muted-foreground">
              Preencha o formulário para ver o resultado em tempo real.
            </p>
          )}

          {resultado?.mensagem ? (
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">Atenção</p>
                <p className="text-sm text-amber-600 dark:text-amber-300 mt-1">{resultado.mensagem}</p>
              </div>
            </div>
          ) : resultado ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valor Mínimo</p>
                <p className="text-2xl font-bold tabular-nums tracking-tight mt-1">
                  {formatBRL(resultado.valorMinimo)}
                </p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">CAPEX</p>
                  <p className="font-semibold tabular-nums">{formatBRL(resultado.valorCapex)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">OPEX</p>
                  <p className="font-semibold tabular-nums">{formatBRL(resultado.valorOpex)}</p>
                </div>
              </div>
            </div>
          ) : null}

          {error && !calculating && (
            <div className="text-sm text-destructive mt-2">{error}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ──

export default function CalcularPage() {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { form, setField, setProduto, buildPayload, loadingData, options, getRoiForVigencia } = useFormPrecificacao();
  const { data: resultado, loading: calculating, error, calcular } = useCalcularPrecificacao();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const initialLoadDone = useRef(false);

  // Auto-calculate on form change (debounced 600ms)
  useEffect(() => {
    if (loadingData) return;
    // Skip auto-calc on initial mount
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const payload = buildPayload();
      calcular(payload as Parameters<typeof calcular>[0]);
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [form, loadingData, buildPayload, calcular]);

  if (authLoading || roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!session || !isAdmin) return <Navigate to="/" replace />;

  const renderProductFields = () => {
    const props = { form, setField, options };
    switch (form.produto) {
      case "Conectividade": return <ConectividadeFields {...props} />;
      case "Firewall": return <FirewallFields {...props} />;
      case "Switch": return <SwitchFields {...props} />;
      case "Wifi": return <WifiFields {...props} />;
      case "VOZ": return <VozFields {...props} />;
      case "Backup": return <BackupFields form={form} setField={setField} />;
      default: return null;
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Calculadora de Precificação
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          O resultado atualiza automaticamente ao alterar os campos
        </p>
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left — Form */}
          <div className="flex-1 space-y-6 min-w-0">
             {/* Global fields */}
             <Card>
               <CardHeader className="pb-4">
                 <CardTitle className="text-base">Dados Gerais</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                   <SelectField
                     label="Categoria NT"
                     value={form.produto}
                     onChange={v => setProduto(v as FormState["produto"])}
                     options={[...PRODUTOS]}
                   />
                   <SelectField
                     label="Vigência"
                     value={form.subproduto === "NT EVENTO" ? "1" : String(form.vigencia)}
                     onChange={v => {
                       const num = Number(v) || 0;
                       setField("vigencia", num);
                       const roi = getRoiForVigencia(v);
                       if (roi !== null) setField("roiVigencia", roi);
                     }}
                     options={VIGENCIA_OPTIONS}
                     disabled={form.subproduto === "NT EVENTO"}
                   />
                   <NumField
                     label="Taxa de Instalação"
                     value={form.taxaInstalacao}
                     onChange={v => setField("taxaInstalacao", v)}
                   />
                 </div>
               </CardContent>
             </Card>

            {/* Product-specific fields */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">
                  Campos — {form.produto}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderProductFields()}
              </CardContent>
            </Card>
          </div>

          {/* Right — Result panel */}
          <div className="lg:w-72 shrink-0">
            <ResultPanel resultado={resultado} calculating={calculating} error={error} />
          </div>
        </div>
      )}
    </div>
  );
}
