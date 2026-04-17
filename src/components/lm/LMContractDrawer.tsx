import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  LMContract,
  LM_STATUS_OPTIONS,
  useUpdateLMContract,
  useDeleteLMContract,
} from "@/hooks/useLMContracts";

interface Props {
  contract: LMContract | null;
  open: boolean;
  onClose: () => void;
}

type FormState = Partial<LMContract>;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-border pb-1.5 text-xs font-bold uppercase tracking-widest text-primary">
      {children}
    </h3>
  );
}

function FieldWrap({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export default function LMContractDrawer({ contract, open, onClose }: Props) {
  const [showSenha, setShowSenha] = useState(false);
  const [form, setForm] = useState<FormState>({});
  const update = useUpdateLMContract();
  const remove = useDeleteLMContract();

  useEffect(() => {
    if (contract) {
      setForm({ ...contract });
      setShowSenha(false);
    }
  }, [contract]);

  if (!contract) return null;

  const set = <K extends keyof LMContract>(key: K, value: LMContract[K] | null) =>
    setForm((p) => ({ ...p, [key]: value as any }));

  const onSave = async () => {
    try {
      // Limpa campos somente-leitura
      const { id, numero, created_at, updated_at, user_id, ...payload } = form as any;
      await update.mutateAsync({ id: contract.id, ...payload });
      toast.success("Contrato atualizado");
      onClose();
    } catch (e: any) {
      toast.error("Falha ao salvar", { description: e?.message ?? String(e) });
    }
  };

  const onDelete = async () => {
    try {
      await remove.mutateAsync(contract.id);
      toast.success("Contrato excluído");
      onClose();
    } catch (e: any) {
      toast.error("Falha ao excluir", { description: e?.message ?? String(e) });
    }
  };

  const txt = (k: keyof LMContract) =>
    (form[k] ?? "") as string;
  const num = (k: keyof LMContract) =>
    form[k] == null ? "" : String(form[k]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2">
            Editar Contrato LM
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              #{contract.numero}
            </span>
          </SheetTitle>
          <SheetDescription>
            Atualize qualquer campo abaixo. Todos são opcionais.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Identificação */}
          <div className="space-y-3">
            <SectionTitle>Identificação</SectionTitle>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <FieldWrap label="PN">
                <Input value={txt("pn")} onChange={(e) => set("pn", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="Nome do PN">
                <Input value={txt("nome_pn")} onChange={(e) => set("nome_pn", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="Grupo">
                <Input value={txt("grupo")} onChange={(e) => set("grupo", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="Etiqueta">
                <Input value={txt("etiqueta")} onChange={(e) => set("etiqueta", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="Nome do Cliente">
                <Input value={txt("nome_cliente")} onChange={(e) => set("nome_cliente", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="Cont. Guarda-Chuva">
                <Input value={txt("cont_guarda_chuva")} onChange={(e) => set("cont_guarda_chuva", e.target.value || null)} />
              </FieldWrap>
            </div>
          </div>

          {/* Contrato */}
          <div className="space-y-3">
            <SectionTitle>Contrato</SectionTitle>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <FieldWrap label="Status">
                <Select
                  value={form.status || ""}
                  onValueChange={(v) => set("status", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {LM_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldWrap>
              <FieldWrap label="Recorrência">
                <Input value={txt("recorrencia")} onChange={(e) => set("recorrencia", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="Modelo (TR)">
                <Input value={txt("modelo_tr")} onChange={(e) => set("modelo_tr", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="Valor Mensal (TR)">
                <Input
                  type="number"
                  step="0.01"
                  value={num("valor_mensal_tr")}
                  onChange={(e) => {
                    const v = e.target.value;
                    set("valor_mensal_tr", v === "" ? null : Number(v));
                  }}
                />
              </FieldWrap>
              <FieldWrap label="Item SAP">
                <Input value={txt("item_sap")} onChange={(e) => set("item_sap", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="Protocolo Elleven">
                <Input value={txt("protocolo_elleven")} onChange={(e) => set("protocolo_elleven", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="Nº Contrato Cliente">
                <Input value={txt("num_contrato_cliente")} onChange={(e) => set("num_contrato_cliente", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="É Last Mile?">
                <div className="flex h-10 items-center">
                  <Switch
                    checked={!!form.is_last_mile}
                    onCheckedChange={(v) => set("is_last_mile", v)}
                  />
                </div>
              </FieldWrap>
              <FieldWrap label="Simples Nacional?">
                <div className="flex h-10 items-center">
                  <Switch
                    checked={!!form.simples_nacional}
                    onCheckedChange={(v) => set("simples_nacional", v)}
                  />
                </div>
              </FieldWrap>
              <FieldWrap label="Endereço de Instalação" full>
                <Textarea
                  value={txt("endereco_instalacao")}
                  onChange={(e) => set("endereco_instalacao", e.target.value || null)}
                  rows={2}
                />
              </FieldWrap>
              <FieldWrap label="Cidade">
                <Input value={txt("cidade")} onChange={(e) => set("cidade", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="UF">
                <Input
                  maxLength={2}
                  value={txt("uf")}
                  onChange={(e) => set("uf", e.target.value.toUpperCase() || null)}
                />
              </FieldWrap>
              <FieldWrap label="Obs. Contrato LM" full>
                <Textarea
                  value={txt("observacao_contrato_lm")}
                  onChange={(e) => set("observacao_contrato_lm", e.target.value || null)}
                  rows={2}
                />
              </FieldWrap>
              <FieldWrap label="Observação Geral" full>
                <Textarea
                  value={txt("observacao_geral")}
                  onChange={(e) => set("observacao_geral", e.target.value || null)}
                  rows={2}
                />
              </FieldWrap>
            </div>
          </div>

          {/* Datas */}
          <div className="space-y-3">
            <SectionTitle>Datas</SectionTitle>
            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
              <FieldWrap label="Data de Assinatura">
                <Input
                  type="date"
                  value={txt("data_assinatura")?.slice(0, 10) || ""}
                  onChange={(e) => set("data_assinatura", e.target.value || null)}
                />
              </FieldWrap>
              <FieldWrap label="Vigência (meses)">
                <Input
                  type="number"
                  value={num("vigencia_meses")}
                  onChange={(e) => {
                    const v = e.target.value;
                    set("vigencia_meses", v === "" ? null : Number(v));
                  }}
                />
              </FieldWrap>
              <FieldWrap label="Data de Término">
                <Input
                  type="date"
                  value={txt("data_termino")?.slice(0, 10) || ""}
                  onChange={(e) => set("data_termino", e.target.value || null)}
                />
              </FieldWrap>
            </div>
          </div>

          {/* Acesso */}
          <div className="space-y-3">
            <SectionTitle>Acesso</SectionTitle>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <FieldWrap label="Site Portal" full>
                <Input
                  value={txt("site_portal")}
                  onChange={(e) => set("site_portal", e.target.value || null)}
                  placeholder="https://..."
                />
              </FieldWrap>
              <FieldWrap label="Login">
                <Input value={txt("login")} onChange={(e) => set("login", e.target.value || null)} />
              </FieldWrap>
              <FieldWrap label="Senha">
                <div className="relative">
                  <Input
                    type={showSenha ? "text" : "password"}
                    value={txt("senha")}
                    onChange={(e) => set("senha", e.target.value || null)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FieldWrap>
            </div>
          </div>

          {/* Footer actions */}
          <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-2 border-t border-border bg-background px-6 py-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir contrato #{contract.numero}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Essa ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="mr-1.5 h-4 w-4" /> Cancelar
              </Button>
              <Button size="sm" onClick={onSave} disabled={update.isPending}>
                {update.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
