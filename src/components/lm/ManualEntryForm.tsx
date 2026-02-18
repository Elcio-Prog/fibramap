import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCompraLM } from "@/hooks/useComprasLM";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from "@/lib/geo-utils";
import { Plus, Loader2 } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const STATUS_OPTIONS = ["Em ativação", "Ativo", "Cancelado", "Suspenso", "Em análise"];

export default function ManualEntryForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const create = useCreateCompraLM();

  const [form, setForm] = useState({
    parceiro: "", cliente: "", endereco: "", cidade: "", uf: "",
    id_etiqueta: "", nr_contrato: "", banda_mbps: "", valor_mensal: "",
    setup: "", data_inicio: "", data_fim: "", status: "Em ativação",
    observacoes: "", lat: null as number | null, lng: null as number | null,
  });

  const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.parceiro || !form.endereco || !form.valor_mensal) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (!form.id_etiqueta && !form.nr_contrato) {
      toast({ title: "Informe ID Etiqueta ou Nº Contrato", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let lat = form.lat;
      let lng = form.lng;
      let geocodingStatus = "pending";

      if (!lat || !lng) {
        const geo = await geocodeAddress(form.endereco);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
          geocodingStatus = "done";
        } else {
          geocodingStatus = "failed";
        }
      } else {
        geocodingStatus = "done";
      }

      await create.mutateAsync({
        parceiro: form.parceiro,
        cliente: form.cliente || null,
        endereco: form.endereco,
        cidade: form.cidade || null,
        uf: form.uf || null,
        id_etiqueta: form.id_etiqueta || null,
        nr_contrato: form.nr_contrato || null,
        banda_mbps: form.banda_mbps ? parseFloat(form.banda_mbps) : null,
        valor_mensal: parseFloat(form.valor_mensal),
        setup: form.setup ? parseFloat(form.setup) : null,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        status: form.status,
        observacoes: form.observacoes || null,
        lat, lng,
        geocoding_status: geocodingStatus,
        user_id: user?.id || null,
        codigo_sap: null,
      });

      toast({ title: "Cadastro criado com sucesso!" });
      setForm({
        parceiro: "", cliente: "", endereco: "", cidade: "", uf: "",
        id_etiqueta: "", nr_contrato: "", banda_mbps: "", valor_mensal: "",
        setup: "", data_inicio: "", data_fim: "", status: "Em ativação",
        observacoes: "", lat: null, lng: null,
      });
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
        <Plus className="h-4 w-4" /> Novo Cadastro LM
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Novo Cadastro LM</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Parceiro <span className="text-destructive">*</span></label>
            <Input value={form.parceiro} onChange={e => set("parceiro", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Cliente</label>
            <Input value={form.cliente} onChange={e => set("cliente", e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium">Endereço <span className="text-destructive">*</span></label>
            <AddressAutocomplete
              value={form.endereco}
              onChange={v => set("endereco", v)}
              onSelect={r => { set("endereco", r.address); set("lat", r.lat); set("lng", r.lng); }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Cidade</label>
            <Input value={form.cidade} onChange={e => set("cidade", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">UF</label>
            <Input value={form.uf} onChange={e => set("uf", e.target.value)} maxLength={2} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">ID Etiqueta</label>
            <Input value={form.id_etiqueta} onChange={e => set("id_etiqueta", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Nº Contrato</label>
            <Input value={form.nr_contrato} onChange={e => set("nr_contrato", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Banda (Mbps)</label>
            <Input type="number" value={form.banda_mbps} onChange={e => set("banda_mbps", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Valor mensal <span className="text-destructive">*</span></label>
            <Input type="number" step="0.01" value={form.valor_mensal} onChange={e => set("valor_mensal", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Setup</label>
            <Input type="number" step="0.01" value={form.setup} onChange={e => set("setup", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Status</label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Data início</label>
            <Input type="date" value={form.data_inicio} onChange={e => set("data_inicio", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Data fim</label>
            <Input type="date" value={form.data_fim} onChange={e => set("data_fim", e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium">Observações</label>
            <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
          </div>
          <div className="md:col-span-2 flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
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
