import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2, History } from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  status: "Status", tipo_solicitacao: "Tipo Solicitação", produto_nt: "Produto NT",
  vigencia: "Vigência", valor_minimo: "Valor Mínimo", viabilidade: "Viabilidade",
  ticket_mensal: "Ticket Mensal", status_aprovacao: "Status Aprovação",
  aprovado_por: "Aprovado por", nome_cliente: "Nome Cliente", previsao_roi: "Previsão ROI",
  roi_global: "ROI Global", projetista: "Projetista", motivo_solicitacao: "Motivo",
  observacoes: "Observações", id_guardachuva: "ID GuardaChuva", codigo_smark: "Cód. SMARK",
  inviabilidade_tecnica: "Inviab. Técnica", comentarios_aprovador: "Coment. Aprovador",
  observacao_validacao: "Obs. Validação", cnpj_cliente: "CNPJ Cliente", endereco: "Endereço",
  coordenadas: "Coordenadas", protocolo: "Protocolo", data_reavaliacao: "Data Reavaliação",
  dados_precificacao: "Dados Precificação", status_viabilidade: "Status Viabilidade",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preViabilidadeId: string | null;
  numero: number | null;
}

interface HistoryEntry {
  id: string;
  changed_at: string;
  changed_by: string | null;
  snapshot: Record<string, any>;
  new_values: Record<string, any>;
  changed_fields: string[];
}

export default function VersionHistoryDialog({ open, onOpenChange, preViabilidadeId, numero }: Props) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["pv-history", preViabilidadeId],
    enabled: open && !!preViabilidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pre_viabilidades_history")
        .select("*")
        .eq("pre_viabilidade_id", preViabilidadeId!)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data as HistoryEntry[];
    },
  });

  const formatValue = (val: any): string => {
    if (val == null) return "—";
    if (typeof val === "object") return JSON.stringify(val).slice(0, 80) + "…";
    if (typeof val === "number") return val.toLocaleString("pt-BR");
    return String(val);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Versões — #{numero}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !history?.length ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhuma modificação registrada ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((entry, idx) => (
                <div key={entry.id} className="relative border rounded-lg p-4">
                  {idx < history.length - 1 && (
                    <div className="absolute left-7 top-full w-px h-3 bg-border" />
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        v{history.length - idx}
                      </Badge>
                      <span className="font-medium">{entry.changed_by || "Sistema"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.changed_at), "dd/MM/yyyy HH:mm:ss")}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[140px_1fr_1fr] gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pb-1 border-b">
                      <span>Campo</span>
                      <span>Anterior</span>
                      <span>Novo</span>
                    </div>
                    {entry.changed_fields.map((field) => (
                      <div key={field} className="grid grid-cols-[140px_1fr_1fr] gap-2 text-xs items-start">
                        <Badge variant="secondary" className="text-[10px] shrink-0 w-fit">
                          {FIELD_LABELS[field] || field}
                        </Badge>
                        <span className="text-muted-foreground">
                          {formatValue(entry.snapshot[field])}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatValue(entry.new_values?.[field])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
