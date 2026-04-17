import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getRoiIndicators } from "@/hooks/usePreViabilidades";

const MOTIVO_OPTIONS = [
  "Concorrência direta",
  "Cliente estratégico",
  "Volume futuro",
  "Penetração em nova região",
  "Parceria comercial",
  "Projeto guarda-chuva",
  "Retenção de cliente",
  "Teste de viabilidade técnica",
  "Campanha promocional",
  "LPU com cliente",
  "Teste expansão Last Mile",
  "Outros",
];

type ApprovalLevel = {
  level: number;
  label: string;
  roi_increment: number;
  value_limit: number;
  responsible_email: string;
};

type ApprovalConfig = {
  levels: ApprovalLevel[];
  criteria: "roi" | "valor";
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preViabilidadeId: string | null;
  numero: number | null;
  vigencia: number | null;
  dadosPrecificacao: Record<string, any> | null;
  hasEquipment: boolean;
  previsaoRoi: number | null;
}

export default function SolicitarAprovacaoDialog({
  open,
  onOpenChange,
  preViabilidadeId,
  numero,
  vigencia,
  dadosPrecificacao,
  hasEquipment,
  previsaoRoi,
}: Props) {
  const { toast } = useToast();
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolvedLevel, setResolvedLevel] = useState<ApprovalLevel | null>(null);
  const [resolvedLabel, setResolvedLabel] = useState("");

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setMotivo("");
      setResolvedLevel(null);
    }
    onOpenChange(v);
  };

  // Resolve approval level when dialog opens
  useEffect(() => {
    if (!open) return;

    const resolve = async () => {
      setLoading(true);
      try {
        // Decide which config to use
        const configKey = hasEquipment
          ? "approval_config_equipment"
          : "approval_config_standard";

        // Fetch approval config
        const configRes = await supabase
          .from("configuracoes")
          .select("valor")
          .eq("chave", configKey)
          .maybeSingle();

        const config = configRes.data?.valor as ApprovalConfig | null;
        if (!config?.levels) {
          setResolvedLevel(null);
          setResolvedLabel("Configuração de aprovação não encontrada");
          return;
        }

        // ROI escolhido: usa a MESMA fonte que a tabela (memoriaCalculo → "ROI Escolhido"),
        // não o valor cru de roiVigencia, para garantir consistência visual e de regra.
        const { roiEscolhido } = getRoiIndicators(dadosPrecificacao);

        // Níveis manuais (level > 0), ordenados por roi_increment crescente.
        // O nível "Diretoria" (level === 999) é sempre o ÚLTIMO fallback,
        // independentemente do roi_increment cadastrado.
        const DIRETORIA_LEVEL = 999;
        const nonDiretoria = config.levels
          .filter((l) => l.level > 0 && l.level !== DIRETORIA_LEVEL)
          .sort((a, b) => (a.roi_increment ?? 0) - (b.roi_increment ?? 0));
        const diretoria = config.levels.find((l) => l.level === DIRETORIA_LEVEL);
        const manualLevels = diretoria ? [...nonDiretoria, diretoria] : nonDiretoria;

        if (config.criteria === "valor") {
          // Modo Valor: compara ticket mensal contra value_limit
          const valor =
            dadosPrecificacao?.ticket_mensal ??
            dadosPrecificacao?.valor_minimo ??
            null;
          let matched: ApprovalLevel | null = null;
          if (valor != null) {
            for (const lvl of [...manualLevels].sort(
              (a, b) => (a.value_limit ?? 0) - (b.value_limit ?? 0)
            )) {
              matched = lvl;
              if (lvl.value_limit > 0 && valor <= lvl.value_limit) break;
            }
          }
          setResolvedLevel(matched ?? manualLevels[manualLevels.length - 1] ?? null);
          setResolvedLabel(
            valor != null
              ? `Critério: Valor (R$ ${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
              : "Critério: Valor"
          );
        } else {
          // Modo ROI: usa o ROI escolhido como referência.
          // Para cada nível, threshold = roiEscolhido + roi_increment.
          // Pega o MENOR nível cujo threshold >= previsao_roi do projeto.
          // Ex: roiEscolhido=5,5 → nível 1 cobre até 6,5 (+1); nível 2 até 7,5 (+2)...
          let matched: ApprovalLevel | null = null;
          if (roiEscolhido != null && previsaoRoi != null) {
            for (const lvl of manualLevels) {
              const threshold = roiEscolhido + (lvl.roi_increment ?? 0);
              if (previsaoRoi <= threshold) {
                matched = lvl;
                break;
              }
            }
            // Estourou todos: usa o nível mais alto
            if (!matched) matched = manualLevels[manualLevels.length - 1] ?? null;
          } else {
            matched = manualLevels[0] ?? null;
          }
          setResolvedLevel(matched);

          const parts: string[] = ["Critério: ROI"];
          if (roiEscolhido != null) parts.push(`escolhido ${roiEscolhido.toFixed(2)}`);
          if (previsaoRoi != null) parts.push(`previsto ${previsaoRoi.toFixed(2)}`);
          setResolvedLabel(parts.join(" • "));
        }
      } catch {
        setResolvedLevel(null);
        setResolvedLabel("Erro ao determinar nível");
      } finally {
        setLoading(false);
      }
    };

    resolve();
  }, [open, vigencia, dadosPrecificacao, hasEquipment, previsaoRoi]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Aprovação {numero != null ? `#${numero}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-52">
                {MOTIVO_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resolved approval target */}
          <div className="space-y-1.5">
            <Label className="text-sm">Solicitar para:</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Determinando nível...
              </div>
            ) : resolvedLevel ? (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{resolvedLevel.label}</Badge>
                  {resolvedLabel && (
                    <span className="text-xs text-muted-foreground">{resolvedLabel}</span>
                  )}
                </div>
                {resolvedLevel.responsible_email ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{resolvedLevel.responsible_email}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhum responsável configurado para este nível
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-destructive">{resolvedLabel || "Não foi possível determinar o nível"}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button
            disabled={!motivo || !resolvedLevel || !resolvedLevel.responsible_email || !preViabilidadeId || submitting}
            onClick={async () => {
              if (!preViabilidadeId || !resolvedLevel) return;
              setSubmitting(true);
              try {
                const { data, error } = await supabase.functions.invoke("send-approval-request", {
                  body: {
                    preViabilidadeId,
                    responsavelEmail: resolvedLevel.responsible_email,
                    nivel: resolvedLevel.level,
                    nivelLabel: resolvedLevel.label,
                    motivo,
                  },
                });
                if (error) throw error;
                if ((data as any)?.success === false) throw new Error((data as any)?.error || "Erro ao enviar");
                toast({
                  title: "Solicitação enviada",
                  description: `Email enviado para ${resolvedLevel.responsible_email}`,
                });
                handleOpenChange(false);
              } catch (e: any) {
                toast({
                  title: "Erro ao enviar solicitação",
                  description: e?.message || "Tente novamente",
                  variant: "destructive",
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Solicitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
