import { format } from "date-fns";
import { Eye, EyeOff, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LMContract } from "@/hooks/useLMContracts";

interface Props {
  contract: LMContract | null;
  open: boolean;
  onClose: () => void;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d + "T00:00:00"), "dd/MM/yyyy"); } catch { return d; }
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground break-words">{value ?? "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="border-b border-border pb-1.5 text-xs font-bold uppercase tracking-widest text-primary">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </div>
  );
}

export default function LMContractDrawer({ contract, open, onClose }: Props) {
  const [showSenha, setShowSenha] = useState(false);

  if (!contract) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2">
            {contract.nome_cliente || contract.num_contrato_cliente || "Contrato LM"}
            <Badge variant="outline">{contract.status}</Badge>
          </SheetTitle>
          <SheetDescription>{contract.num_contrato_cliente || "Sem nº de contrato"}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Section title="Identificação">
            <Field label="PN" value={contract.pn} />
            <Field label="Nome do PN" value={contract.nome_pn} />
            <Field label="Grupo" value={contract.grupo} />
            <Field label="Etiqueta" value={contract.etiqueta} />
            <Field label="Nome do Cliente" value={contract.nome_cliente} />
            <Field label="Cont. Guarda-Chuva" value={contract.cont_guarda_chuva} />
          </Section>

          <Section title="Contrato">
            <Field label="Status" value={<Badge variant="outline">{contract.status}</Badge>} />
            <Field label="Recorrência" value={contract.recorrencia} />
            <Field label="Modelo (TR)" value={contract.modelo_tr} />
            <Field label="Valor Mensal (TR)" value={fmtMoney(contract.valor_mensal_tr)} />
            <Field label="Item SAP" value={contract.item_sap} />
            <Field label="Protocolo Elleven" value={contract.protocolo_elleven} />
            <Field label="Nº Contrato Cliente" value={contract.num_contrato_cliente} />
            <Field label="É Last Mile?" value={<Badge variant={contract.is_last_mile ? "default" : "secondary"}>{contract.is_last_mile ? "Sim" : "Não"}</Badge>} />
            <Field label="Simples Nacional?" value={<Badge variant={contract.simples_nacional ? "default" : "secondary"}>{contract.simples_nacional ? "Sim" : "Não"}</Badge>} />
            <div className="col-span-2"><Field label="Endereço de Instalação" value={contract.endereco_instalacao} /></div>
            <div className="col-span-2"><Field label="Obs. Contrato LM" value={contract.observacao_contrato_lm} /></div>
            <div className="col-span-2"><Field label="Observação Geral" value={contract.observacao_geral} /></div>
          </Section>

          <Section title="Datas">
            <Field label="Data de Assinatura" value={fmtDate(contract.data_assinatura)} />
            <Field label="Vigência (meses)" value={contract.vigencia_meses} />
            <Field label="Data de Término" value={fmtDate(contract.data_termino)} />
          </Section>

          <Section title="Acesso">
            <Field
              label="Site Portal"
              value={
                contract.site_portal ? (
                  <a href={contract.site_portal} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    {contract.site_portal} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : "—"
              }
            />
            <Field label="Login" value={contract.login} />
            <div className="col-span-2">
              <Field
                label="Senha"
                value={
                  contract.senha ? (
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-0.5 text-xs">
                        {showSenha ? contract.senha : "•".repeat(Math.min(contract.senha.length, 12))}
                      </code>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setShowSenha((s) => !s)}>
                        {showSenha ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ) : "—"
                }
              />
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
