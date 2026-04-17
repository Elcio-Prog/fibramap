import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUpsertLMContracts, LM_STATUS_OPTIONS, type LMContractInput } from "@/hooks/useLMContracts";
import { useAuth } from "@/contexts/AuthContext";
import { geocodeAddress } from "@/lib/geo-utils";
import { Plus, Loader2 } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const EMPTY: LMContractInput & { lat?: number | null; lng?: number | null } = {
  status: "Novo - A instalar",
  pn: "",
  nome_pn: "",
  grupo: "",
  recorrencia: "",
  cont_guarda_chuva: "",
  modelo_tr: "",
  valor_mensal_tr: 0,
  observacao_contrato_lm: "",
  item_sap: "",
  protocolo_elleven: "",
  nome_cliente: "",
  etiqueta: "",
  num_contrato_cliente: "",
  endereco_instalacao: "",
  data_assinatura: null,
  vigencia_meses: null,
  data_termino: null,
  is_last_mile: true,
  simples_nacional: false,
  observacao_geral: "",
  site_portal: "",
  login: "",
  senha: "",
};

export default function ManualEntryForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const upsert = useUpsertLMContracts();

  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });

  const set = <K extends keyof typeof EMPTY>(key: K, val: (typeof EMPTY)[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.endereco_instalacao || !form.nome_cliente) {
      toast({ title: "Preencha pelo menos Cliente e Endereço", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let lat = form.lat ?? null;
      let lng = form.lng ?? null;
      let geocoding_status = "pending";

      if (!lat || !lng) {
        const geo = await geocodeAddress(form.endereco_instalacao);
        if (geo) { lat = geo.lat; lng = geo.lng; geocoding_status = "done"; }
        else geocoding_status = "failed";
      } else {
        geocoding_status = "done";
      }

      const payload: LMContractInput = {
        ...form,
        valor_mensal_tr: Number(form.valor_mensal_tr) || 0,
        vigencia_meses: form.vigencia_meses ? Number(form.vigencia_meses) : null,
        user_id: user?.id ?? null,
        lat,
        lng,
        geocoding_status,
      };
      // remove helper-only keys
      delete (payload as any).lat_helper;

      await upsert.mutateAsync([payload]);
      toast({ title: "Cadastro criado com sucesso!" });
      setForm({ ...EMPTY });
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Novo Contrato LM
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Novo Contrato LM</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Status</label>
                <Select value={form.status as string} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LM_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Nome do Cliente <span className="text-destructive">*</span></label>
                <Input value={form.nome_cliente ?? ""} onChange={e => set("nome_cliente", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Nº Contrato Cliente</label>
                <Input value={form.num_contrato_cliente ?? ""} onChange={e => set("num_contrato_cliente", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">PN</label>
                <Input value={form.pn ?? ""} onChange={e => set("pn", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Nome do PN</label>
                <Input value={form.nome_pn ?? ""} onChange={e => set("nome_pn", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Grupo</label>
                <Input value={form.grupo ?? ""} onChange={e => set("grupo", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Etiqueta</label>
                <Input value={form.etiqueta ?? ""} onChange={e => set("etiqueta", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Item SAP</label>
                <Input value={form.item_sap ?? ""} onChange={e => set("item_sap", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Protocolo Elleven</label>
                <Input value={form.protocolo_elleven ?? ""} onChange={e => set("protocolo_elleven", e.target.value)} />
              </div>
            </div>
          </section>

          {/* Contrato */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contrato</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Recorrência</label>
                <Input value={form.recorrencia ?? ""} onChange={e => set("recorrencia", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Cont. Guarda-Chuva</label>
                <Input value={form.cont_guarda_chuva ?? ""} onChange={e => set("cont_guarda_chuva", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Modelo (TR)</label>
                <Input value={form.modelo_tr ?? ""} onChange={e => set("modelo_tr", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Valor Mensal (TR)</label>
                <Input type="number" step="0.01" value={form.valor_mensal_tr ?? 0} onChange={e => set("valor_mensal_tr", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={!!form.is_last_mile} onCheckedChange={v => set("is_last_mile", v)} />
                <span className="text-sm">É Last Mile?</span>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={!!form.simples_nacional} onCheckedChange={v => set("simples_nacional", v)} />
                <span className="text-sm">Simples Nacional?</span>
              </div>
              <div className="space-y-1 md:col-span-3">
                <label className="text-sm font-medium">Endereço de Instalação <span className="text-destructive">*</span></label>
                <AddressAutocomplete
                  value={form.endereco_instalacao ?? ""}
                  onChange={v => set("endereco_instalacao", v)}
                  onSelect={r => {
                    set("endereco_instalacao", r.address);
                    setForm(prev => ({ ...prev, lat: r.lat, lng: r.lng } as any));
                  }}
                />
              </div>
              <div className="space-y-1 md:col-span-3">
                <label className="text-sm font-medium">Obs. Contrato LM</label>
                <Textarea rows={2} value={form.observacao_contrato_lm ?? ""} onChange={e => set("observacao_contrato_lm", e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-3">
                <label className="text-sm font-medium">Observação Geral</label>
                <Textarea rows={2} value={form.observacao_geral ?? ""} onChange={e => set("observacao_geral", e.target.value)} />
              </div>
            </div>
          </section>

          {/* Datas */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Datas</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Data de Assinatura</label>
                <Input type="date" value={form.data_assinatura ?? ""} onChange={e => set("data_assinatura", e.target.value || null)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Vigência (meses)</label>
                <Input type="number" value={form.vigencia_meses ?? ""} onChange={e => set("vigencia_meses", e.target.value ? parseInt(e.target.value) : null)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Data de Término</label>
                <Input type="date" value={form.data_termino ?? ""} onChange={e => set("data_termino", e.target.value || null)} />
              </div>
            </div>
          </section>

          {/* Acesso */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acesso</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Site Portal</label>
                <Input value={form.site_portal ?? ""} onChange={e => set("site_portal", e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Login</label>
                <Input value={form.login ?? ""} onChange={e => set("login", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Senha</label>
                <Input type="password" value={form.senha ?? ""} onChange={e => set("senha", e.target.value)} />
              </div>
            </div>
          </section>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setForm({ ...EMPTY }); setOpen(false); }}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
