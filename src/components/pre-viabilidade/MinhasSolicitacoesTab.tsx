import { useMemo, useState } from "react";
import { fmId } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Inbox, Clock, Mail, CheckCircle2, XCircle, Hourglass, MessageSquare } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
};

const fmtMoney = (v: any) =>
  v == null
    ? "—"
    : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MinhasSolicitacoesTab() {
  const { user } = useAuth();
  const [filtro, setFiltro] = useState<"abertas" | "fechadas" | "aprovadas" | "reprovadas">("abertas");

  const { data: tokens, isLoading } = useQuery({
    queryKey: ["minhas-solicitacoes", user?.email],
    queryFn: async () => {
      if (!user?.email) return [] as TokenRow[];
      const { data, error } = await supabase
        .from("aprovacao_tokens")
        .select(
          "id, token, pre_viabilidade_id, responsavel_email, nivel, nivel_label, motivo, solicitante_email, solicitante_nome, acao_realizada, acao_em, expires_at, created_at, comentario"
        )
        .eq("solicitante_email", user.email)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TokenRow[];
    },
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  const pvIds = useMemo(
    () => Array.from(new Set((tokens || []).map((t) => t.pre_viabilidade_id))),
    [tokens]
  );

  const { data: pvs } = useQuery({
    queryKey: ["minhas-solicitacoes-pvs", pvIds],
    queryFn: async () => {
      if (pvIds.length === 0) return [] as PvRow[];
      const { data, error } = await supabase
        .from("pre_viabilidades")
        .select(
          "id, numero, nome_cliente, cnpj_cliente, endereco, produto_nt, tipo_solicitacao, vigencia, ticket_mensal, valor_minimo, previsao_roi, status_aprovacao"
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

  const counts = useMemo(() => {
    const all = tokens || [];
    return {
      abertas: all.filter((t) => !t.acao_realizada && new Date(t.expires_at) >= new Date()).length,
      fechadas: all.filter((t) => t.acao_realizada || new Date(t.expires_at) < new Date()).length,
      aprovadas: all.filter((t) => t.acao_realizada === "aprovar").length,
      reprovadas: all.filter((t) => t.acao_realizada === "reprovar").length,
    };
  }, [tokens]);

  const filtrados = useMemo(() => {
    const all = tokens || [];
    const now = new Date();
    if (filtro === "abertas") return all.filter((t) => !t.acao_realizada && new Date(t.expires_at) >= now);
    if (filtro === "fechadas") return all.filter((t) => t.acao_realizada || new Date(t.expires_at) < now);
    if (filtro === "aprovadas") return all.filter((t) => t.acao_realizada === "aprovar");
    if (filtro === "reprovadas") return all.filter((t) => t.acao_realizada === "reprovar");
    return all;
  }, [tokens, filtro]);

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
        <p className="text-sm font-medium">Nenhuma solicitação enviada</p>
        <p className="text-xs mt-1">Você ainda não enviou nenhuma solicitação de aprovação.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)}>
        <TabsList>
          <TabsTrigger value="abertas" className="gap-2">
            <Hourglass className="h-3.5 w-3.5" />
            Abertas
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
              {counts.abertas}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="fechadas" className="gap-2">
            <Inbox className="h-3.5 w-3.5" />
            Fechadas
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
              {counts.fechadas}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="aprovadas" className="gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aprovadas
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
              {counts.aprovadas}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="reprovadas" className="gap-2">
            <XCircle className="h-3.5 w-3.5" />
            Reprovadas
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
              {counts.reprovadas}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filtro} className="mt-4">
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-60" />
              <p className="text-sm">Nenhuma solicitação nesta categoria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtrados.map((tk) => {
                const pv = pvById.get(tk.pre_viabilidade_id);
                const expired = new Date(tk.expires_at) < new Date();
                const acao = tk.acao_realizada;
                const borderColor =
                  acao === "aprovar"
                    ? "border-l-green-600"
                    : acao === "reprovar"
                    ? "border-l-destructive"
                    : expired
                    ? "border-l-muted-foreground"
                    : "border-l-amber-500";

                return (
                  <Card key={tk.id} className={`border-l-4 ${borderColor}`}>
                    <CardHeader className="pb-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold">
                              Pré-Viabilidade {fmId(pv?.numero)}
                            </h3>
                            <Badge variant="secondary" className="text-[10px]">
                              {tk.nivel_label}
                            </Badge>
                            {acao === "aprovar" && (
                              <Badge className="text-[10px] bg-green-600 hover:bg-green-700">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Aprovada
                              </Badge>
                            )}
                            {acao === "reprovar" && (
                              <Badge variant="destructive" className="text-[10px]">
                                <XCircle className="h-3 w-3 mr-1" />
                                Reprovada
                              </Badge>
                            )}
                            {!acao && expired && (
                              <Badge variant="outline" className="text-[10px]">
                                Expirada
                              </Badge>
                            )}
                            {!acao && !expired && (
                              <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700">
                                <Hourglass className="h-3 w-3 mr-1" />
                                Aguardando
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Enviada em {new Date(tk.created_at).toLocaleString("pt-BR")}
                          </p>
                          {tk.acao_em && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Decidida em {new Date(tk.acao_em).toLocaleString("pt-BR")}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Mail className="h-3 w-3" />
                          {tk.responsavel_email}
                        </Badge>
                      </div>

                      <div className="rounded bg-muted/50 border-l-4 border-muted-foreground/30 p-2 text-xs space-y-0.5">
                        <p>
                          <strong>Motivo:</strong> {tk.motivo}
                        </p>
                      </div>

                      {tk.comentario && (
                        <div className="rounded bg-blue-50 border-l-4 border-blue-500 p-2 text-xs">
                          <p className="text-blue-900 flex items-start gap-1">
                            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>
                              <strong>Comentário do aprovador:</strong> {tk.comentario}
                            </span>
                          </p>
                        </div>
                      )}
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
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
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
