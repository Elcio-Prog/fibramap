import { useState, useEffect } from "react";
import { PreViabilidade, useUpdatePreViabilidade } from "@/hooks/usePreViabilidades";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Props {
  item: PreViabilidade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export default function PreViabilidadeEditDrawer({ item, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const updateMutation = useUpdatePreViabilidade();

  const [form, setForm] = useState({
    status: "",
    tipo_solicitacao: "",
    produto_nt: "",
    vigencia: "" as string,
    viabilidade: "",
    ticket_mensal: "" as string,
    nome_cliente: "",
    motivo_solicitacao: "",
    observacoes: "",
    codigo_smark: "",
    id_guardachuva: "",
    origem: "",
    criado_por: "",
    status_aprovacao: "",
    aprovado_por: "",
    projetista: "",
    status_viabilidade: "",
    inviabilidade_tecnica: "",
    comentarios_aprovador: "",
    observacao_validacao: "",
  });

  useEffect(() => {
    if (item) {
      setForm({
        status: item.status || "Ativa",
        tipo_solicitacao: item.tipo_solicitacao || "",
        produto_nt: item.produto_nt || "",
        vigencia: item.vigencia != null ? String(item.vigencia) : "",
        viabilidade: item.viabilidade || "",
        ticket_mensal: item.ticket_mensal != null ? String(item.ticket_mensal) : "",
        nome_cliente: item.nome_cliente || "",
        motivo_solicitacao: item.motivo_solicitacao || "",
        observacoes: item.observacoes || "",
        codigo_smark: item.codigo_smark || "",
        id_guardachuva: item.id_guardachuva || "",
        origem: item.origem || "",
        criado_por: item.criado_por || "",
        status_aprovacao: item.status_aprovacao || "",
        aprovado_por: item.aprovado_por || "",
        projetista: item.projetista || "",
        status_viabilidade: item.status_viabilidade || "",
        inviabilidade_tecnica: item.inviabilidade_tecnica || "",
        comentarios_aprovador: item.comentarios_aprovador || "",
        observacao_validacao: item.observacao_validacao || "",
      });
    }
  }, [item]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!item) return;
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        updates: {
          status: form.status || null,
          tipo_solicitacao: form.tipo_solicitacao || null,
          produto_nt: form.produto_nt || null,
          vigencia: form.vigencia ? Number(form.vigencia) : null,
          viabilidade: form.viabilidade || null,
          ticket_mensal: form.ticket_mensal ? Number(form.ticket_mensal) : null,
          nome_cliente: form.nome_cliente || null,
          motivo_solicitacao: form.motivo_solicitacao || null,
          observacoes: form.observacoes || null,
          codigo_smark: form.codigo_smark || null,
          id_guardachuva: form.id_guardachuva || null,
          origem: form.origem || null,
          criado_por: form.criado_por || null,
          status_aprovacao: form.status_aprovacao || null,
          aprovado_por: form.aprovado_por || null,
          projetista: form.projetista || null,
          status_viabilidade: form.status_viabilidade || null,
          inviabilidade_tecnica: form.inviabilidade_tecnica || null,
          comentarios_aprovador: form.comentarios_aprovador || null,
          observacao_validacao: form.observacao_validacao || null,
        },
      });
      toast({ title: "Registro atualizado com sucesso!" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pré Viabilidade</DialogTitle>
          <DialogDescription>
            #{item.id.slice(0, 4).toUpperCase()} — {item.nome_cliente || item.viabilidade || "Registro"}
          </DialogDescription>
        </DialogHeader>

        {/* Valor Mínimo — read-only */}
        <div>
          <Label className="text-xs text-muted-foreground">Valor Mínimo (somente leitura)</Label>
          <div className="mt-1 px-3 py-2 rounded-md border border-input bg-muted/50 text-sm min-h-[40px] flex items-center font-semibold">
            {formatCurrency(item.valor_minimo)}
          </div>
        </div>

        <Separator />

        {/* Editable fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativa">Ativa</SelectItem>
                  <SelectItem value="Fechado">Fechado</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Nome do Cliente</Label>
              <Input className="mt-1" value={form.nome_cliente} onChange={set("nome_cliente")} />
            </div>
            <div>
              <Label className="text-xs">Produto NT</Label>
              <Input className="mt-1" value={form.produto_nt} onChange={set("produto_nt")} />
            </div>
            <div>
              <Label className="text-xs">Tipo de Solicitação</Label>
              <Input className="mt-1" value={form.tipo_solicitacao} onChange={set("tipo_solicitacao")} />
            </div>
            <div>
              <Label className="text-xs">Viabilidade</Label>
              <Input className="mt-1" value={form.viabilidade} onChange={set("viabilidade")} />
            </div>
            <div>
              <Label className="text-xs">Vigência (meses)</Label>
              <Input className="mt-1" type="number" value={form.vigencia} onChange={set("vigencia")} />
            </div>
            <div>
              <Label className="text-xs">Ticket Mensal</Label>
              <Input className="mt-1" type="number" step="0.01" value={form.ticket_mensal} onChange={set("ticket_mensal")} />
            </div>
            <div>
              <Label className="text-xs">Código SMARK</Label>
              <Input className="mt-1" value={form.codigo_smark} onChange={set("codigo_smark")} />
            </div>
            <div>
              <Label className="text-xs">ID GuardaChuva</Label>
              <Input className="mt-1" value={form.id_guardachuva} onChange={set("id_guardachuva")} />
            </div>
            <div>
              <Label className="text-xs">Criado por</Label>
              <Input className="mt-1" value={form.criado_por} onChange={set("criado_por")} />
            </div>
            <div>
              <Label className="text-xs">Origem</Label>
              <Input className="mt-1" value={form.origem} onChange={set("origem")} />
            </div>
            <div>
              <Label className="text-xs">Status Aprovação</Label>
              <Input className="mt-1" value={form.status_aprovacao} onChange={set("status_aprovacao")} />
            </div>
            <div>
              <Label className="text-xs">Aprovado por</Label>
              <Input className="mt-1" value={form.aprovado_por} onChange={set("aprovado_por")} />
            </div>
            <div>
              <Label className="text-xs">Projetista</Label>
              <Input className="mt-1" value={form.projetista} onChange={set("projetista")} />
            </div>
            <div>
              <Label className="text-xs">Status de Viabilidade</Label>
              <Input className="mt-1" value={form.status_viabilidade} onChange={set("status_viabilidade")} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Motivo Solicitação</Label>
            <Textarea className="mt-1" rows={2} value={form.motivo_solicitacao} onChange={set("motivo_solicitacao")} />
          </div>
          <div>
            <Label className="text-xs">Inviabilidade Técnica</Label>
            <Textarea className="mt-1" rows={2} value={form.inviabilidade_tecnica} onChange={set("inviabilidade_tecnica")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Comentários do Aprovador</Label>
              <Textarea className="mt-1" rows={3} value={form.comentarios_aprovador} onChange={set("comentarios_aprovador")} />
            </div>
            <div>
              <Label className="text-xs">Observação Validação</Label>
              <Textarea className="mt-1" rows={3} value={form.observacao_validacao} onChange={set("observacao_validacao")} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea className="mt-1" rows={3} value={form.observacoes} onChange={set("observacoes")} />
          </div>
        </div>

        <div className="flex gap-2 pt-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
