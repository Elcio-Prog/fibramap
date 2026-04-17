import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, Mail, Inbox, Clock, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TokenRow = {
  id: string;
  token: string;
  pre_viabilidade_id: string;
  responsavel_email: string;
  nivel: number;
  nivel_label: string;
  motivo: string;
  solicitante_email: string | null;
  solicitante_nome: string | null;
  acao_realizada: string | null;
  acao_em: string | null;
  expires_at: string;
  created_at: string;
  comentario: string | null;
};

type PvRow = {
  id: string;
  numero: number;
  nome_cliente: string | null;
  cnpj_cliente: string | null;
  endereco: string | null;
  produto_nt: string | null;
  tipo_solicitacao: string | null;
  vigencia: number | null;
  ticket_mensal: number | null;
  valor_minimo: number | null;
  previsao_roi: number | null;
  status_aprovacao: string | null;
  dados_precificacao: any;
};

const fmtMoney = (v: any) =>
  v == null
    ? "—"
    : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AprovacoesTab() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [submittingToken, setSubmittingToken] = useState<string | null>(null);
  const [comentarios, setComentarios] = useState<Record<string, string>>({});

  const { data: tokens, isLoading } = useQuery({
    queryKey: ["aprovacao-tokens-pendentes", user?.email, isAdmin],
    queryFn: async () => {
      let q = supabase
        .from("aprovacao_tokens")
        .select(
          "id, token, pre_viabilidade_id, responsavel_email, nivel, nivel_label, motivo, solicitante_email, solicitante_nome, acao_realizada, acao_em, expires_at, created_at, comentario"
        )
        .is("acao_realizada", null)
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        q = q.eq("responsavel_email", user?.email || "__none__");
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as TokenRow[];
    },
    enabled: !!user,
  });

  const pvIds = useMemo(
    () => Array.from(new Set((tokens || []).map((t) => t.pre_viabilidade_id))),
    [tokens]
  );

  const { data: pvs } = useQuery({
    queryKey: ["aprovacao-pvs", pvIds],
    queryFn: async () => {
      if (pvIds.length === 0) return [] as PvRow[];
      const { data, error } = await supabase
        .from("pre_viabilidades")
        .select(
          "id, numero, nome_cliente, cnpj_cliente, endereco, produto_nt, vigencia, ticket_mensal, valor_minimo, previsao_roi, status_aprovacao, dados_precificacao"
        )
        .in("id", pvIds);
      if (error) throw error;
      return (data || []) as PvRow[];
    },
    enabled: pvIds.length > 0,
  });

  const pvById = useMemo(() => {
    const m = new Map<string, PvRow>();
    (pvs || []).forEach((p) => m.set(p.id, p));
    return m;
  }, [pvs]);

  const decide = async (tk: TokenRow, acao: "aprovar" | "reprovar") => {
    setSubmittingToken(tk.token);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aprovacao-decidir`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tk.token,
          acao,
          comentario: comentarios[tk.token] || "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro");
      toast({
        title: acao === "aprovar" ? "Aprovação registrada" : "Reprovação registrada",
        description: `Pré-Viabilidade #${pvById.get(tk.pre_viabilidade_id)?.numero ?? ""} atualizada`,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["aprovacao-tokens-pendentes"] }),
        qc.invalidateQueries({ queryKey: ["aprovacao-tokens-pending-count"] }),
        qc.invalidateQueries({ queryKey: ["pre-viabilidades"] }),
      ]);
    } catch (e: any) {
      toast({
        title: "Erro ao registrar decisão",
        description: e?.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSubmittingToken(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tokens || tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Inbox className="h-10 w-10 mb-3 opacity-60" />
        <p className="text-sm font-medium">Nenhuma aprovação pendente</p>
        <p className="text-xs mt-1">
          {isAdmin
            ? "Não há solicitações em aberto."
            : "Você não tem solicitações aguardando sua decisão."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {tokens.map((tk) => {
        const pv = pvById.get(tk.pre_viabilidade_id);
        const isSubmitting = submittingToken === tk.token;
        const expired = new Date(tk.expires_at) < new Date();
        return (
          <Card key={tk.id} className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold">
                      Pré-Viabilidade #{pv?.numero ?? "—"}
                    </h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {tk.nivel_label}
                    </Badge>
                    {expired && (
                      <Badge variant="destructive" className="text-[10px]">
                        Expirado
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(tk.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Mail className="h-3 w-3" />
                  {tk.responsavel_email}
                </Badge>
              </div>

              <div className="rounded bg-amber-50 border-l-4 border-amber-500 p-2 text-xs space-y-0.5">
                <p className="text-amber-900">
                  <strong>Solicitante:</strong> {tk.solicitante_nome || "—"}
                  {tk.solicitante_email ? ` (${tk.solicitante_email})` : ""}
                </p>
                <p className="text-amber-900">
                  <strong>Motivo:</strong> {tk.motivo}
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <Field label="Cliente" value={pv?.nome_cliente} />
                <Field label="CNPJ" value={pv?.cnpj_cliente} />
                <Field label="Endereço" value={pv?.endereco} className="col-span-2" />
                <Field label="Produto NT" value={pv?.produto_nt} />
                <Field
                  label="Vigência"
                  value={pv?.vigencia ? `${pv.vigencia} meses` : "—"}
                />
                <Field label="Ticket Mensal" value={fmtMoney(pv?.ticket_mensal)} />
                <Field label="Valor Mínimo" value={fmtMoney(pv?.valor_minimo)} />
                <Field
                  label="Previsão ROI"
                  value={
                    pv?.previsao_roi != null
                      ? `${Number(pv.previsao_roi).toFixed(2)}%`
                      : "—"
                  }
                />
                {pv?.dados_precificacao?.roiVigencia != null && (
                  <Field
                    label="ROI Limite (Vigência)"
                    value={`${Number(pv.dados_precificacao.roiVigencia).toFixed(2)}%`}
                  />
                )}
              </div>

              <Textarea
                value={comentarios[tk.token] || ""}
                onChange={(e) =>
                  setComentarios((prev) => ({ ...prev, [tk.token]: e.target.value }))
                }
                placeholder="Comentário (opcional)..."
                rows={2}
                className="text-xs"
                disabled={isSubmitting || expired}
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => decide(tk, "reprovar")}
                  disabled={isSubmitting || expired}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                  )}
                  Reprovar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => decide(tk, "aprovar")}
                  disabled={isSubmitting || expired}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Aprovar
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: any;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-medium truncate">{value || "—"}</p>
    </div>
  );
}
