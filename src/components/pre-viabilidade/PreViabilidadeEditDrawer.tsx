import { useState, useEffect } from "react";
import { PreViabilidade, useUpdatePreViabilidade } from "@/hooks/usePreViabilidades";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface Props {
  item: PreViabilidade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PreViabilidadeEditDrawer({ item, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const updateMutation = useUpdatePreViabilidade();

  const [form, setForm] = useState({
    status_aprovacao: "",
    aprovado_por: "",
    projetista: "",
    comentarios_aprovador: "",
    observacao_validacao: "",
    inviabilidade_tecnica: "",
    status: "",
    status_viabilidade: "",
  });

  useEffect(() => {
    if (item) {
      setForm({
        status_aprovacao: item.status_aprovacao || "",
        aprovado_por: item.aprovado_por || "",
        projetista: item.projetista || "",
        comentarios_aprovador: item.comentarios_aprovador || "",
        observacao_validacao: item.observacao_validacao || "",
        inviabilidade_tecnica: item.inviabilidade_tecnica || "",
        status: item.status || "Ativa",
        status_viabilidade: item.status_viabilidade || "",
      });
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        updates: {
          status_aprovacao: form.status_aprovacao || null,
          aprovado_por: form.aprovado_por || null,
          projetista: form.projetista || null,
          comentarios_aprovador: form.comentarios_aprovador || null,
          observacao_validacao: form.observacao_validacao || null,
          inviabilidade_tecnica: form.inviabilidade_tecnica || null,
          status: form.status || null,
          status_viabilidade: form.status_viabilidade || null,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Pré Viabilidade</SheetTitle>
          <SheetDescription>
            #{item.id.slice(0, 4).toUpperCase()} — {item.nome_cliente || item.viabilidade || "Registro"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
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

          <div>
            <Label className="text-xs">Inviabilidade Técnica</Label>
            <Textarea className="mt-1" rows={2} value={form.inviabilidade_tecnica} onChange={(e) => setForm((f) => ({ ...f, inviabilidade_tecnica: e.target.value }))} />
          </div>

          <div>
            <Label className="text-xs">Comentários do Aprovador</Label>
            <Textarea className="mt-1" rows={3} value={form.comentarios_aprovador} onChange={(e) => setForm((f) => ({ ...f, comentarios_aprovador: e.target.value }))} />
          </div>

          <div>
            <Label className="text-xs">Observação Validação</Label>
            <Textarea className="mt-1" rows={3} value={form.observacao_validacao} onChange={(e) => setForm((f) => ({ ...f, observacao_validacao: e.target.value }))} />
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="flex-1 gap-2">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
