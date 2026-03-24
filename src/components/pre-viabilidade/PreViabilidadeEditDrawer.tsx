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

  const handleSave = async () => {
    if (!item) return;
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        updates: {
          status: form.status || null,
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

  const ReadOnlyField = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1 px-3 py-2 rounded-md border border-input bg-muted/50 text-sm min-h-[40px] flex items-center">
        {value || "—"}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pré Viabilidade</DialogTitle>
          <DialogDescription>
            #{item.id.slice(0, 4).toUpperCase()} — {item.nome_cliente || item.viabilidade || "Registro"}
          </DialogDescription>
        </DialogHeader>

        {/* Read-only info section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Informações do Registro</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ReadOnlyField label="Nome do Cliente" value={item.nome_cliente} />
            <ReadOnlyField label="Produto NT" value={item.produto_nt} />
            <ReadOnlyField label="Tipo de Solicitação" value={item.tipo_solicitacao} />
            <ReadOnlyField label="Viabilidade" value={item.viabilidade} />
            <ReadOnlyField label="Vigência" value={item.vigencia != null ? `${item.vigencia} meses` : null} />
            <ReadOnlyField label="Ticket Mensal" value={formatCurrency(item.ticket_mensal)} />
            <div className="sm:col-span-1">
              <Label className="text-xs text-muted-foreground">Valor Mínimo</Label>
              <div className="mt-1 px-3 py-2 rounded-md border border-input bg-amber-50 dark:bg-amber-950/30 text-sm min-h-[40px] flex items-center font-semibold text-amber-800 dark:text-amber-300">
                {formatCurrency(item.valor_minimo)}
              </div>
            </div>
            <ReadOnlyField label="Criado por" value={item.criado_por} />
            <ReadOnlyField label="Origem" value={item.origem} />
            <ReadOnlyField label="Motivo Solicitação" value={item.motivo_solicitacao} />
            <ReadOnlyField label="Código SMARK" value={item.codigo_smark} />
            <ReadOnlyField label="ID GuardaChuva" value={item.id_guardachuva} />
          </div>
          {item.observacoes && (
            <ReadOnlyField label="Observações" value={item.observacoes} />
          )}
        </div>

        <Separator />

        {/* Editable section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Campos Editáveis</h3>
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
              <Label className="text-xs">Status Aprovação</Label>
              <Input className="mt-1" value={form.status_aprovacao} onChange={(e) => setForm((f) => ({ ...f, status_aprovacao: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Aprovado por</Label>
              <Input className="mt-1" value={form.aprovado_por} onChange={(e) => setForm((f) => ({ ...f, aprovado_por: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Projetista</Label>
              <Input className="mt-1" value={form.projetista} onChange={(e) => setForm((f) => ({ ...f, projetista: e.target.value }))} />
            </div>

            <div>
              <Label className="text-xs">Status de Viabilidade</Label>
              <Input className="mt-1" value={form.status_viabilidade} onChange={(e) => setForm((f) => ({ ...f, status_viabilidade: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Inviabilidade Técnica</Label>
            <Textarea className="mt-1" rows={2} value={form.inviabilidade_tecnica} onChange={(e) => setForm((f) => ({ ...f, inviabilidade_tecnica: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Comentários do Aprovador</Label>
              <Textarea className="mt-1" rows={3} value={form.comentarios_aprovador} onChange={(e) => setForm((f) => ({ ...f, comentarios_aprovador: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Observação Validação</Label>
              <Textarea className="mt-1" rows={3} value={form.observacao_validacao} onChange={(e) => setForm((f) => ({ ...f, observacao_validacao: e.target.value }))} />
            </div>
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
