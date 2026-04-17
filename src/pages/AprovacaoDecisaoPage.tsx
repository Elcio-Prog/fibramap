import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { getRoiIndicators } from "@/hooks/usePreViabilidades";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aprovacao-decidir`;

export default function AprovacaoDecisaoPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const acaoInicial = searchParams.get("acao") as "aprovar" | "reprovar" | null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [acaoEscolhida, setAcaoEscolhida] = useState<"aprovar" | "reprovar" | null>(acaoInicial);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${token}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro");
        setData(json);
        if (json.token?.acao_realizada) setDone(json.token.acao_realizada);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const submit = async () => {
    if (!acaoEscolhida) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, acao: acaoEscolhida, comentario }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro");
      setDone(acaoEscolhida);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle>Link inválido</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const pv = data?.pre_viabilidade;
  const tk = data?.token;
  const fmtMoney = (v: any) =>
    v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (done) {
    const isApr = done === "aprovar" || done === "Aprovado";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className={`mx-auto h-14 w-14 rounded-full flex items-center justify-center ${isApr ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
              {isApr ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
            </div>
            <CardTitle>Decisão registrada</CardTitle>
            <CardDescription>
              Pré-Viabilidade #{pv?.numero} foi <strong>{isApr ? "aprovada" : "reprovada"}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-xs text-muted-foreground">
            Você já pode fechar esta janela.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 flex items-start justify-center py-10">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Pré-Viabilidade #{pv?.numero}</CardTitle>
              <CardDescription>Solicitação de aprovação</CardDescription>
            </div>
            <Badge variant="secondary">{tk?.nivel_label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-amber-50 border-l-4 border-amber-500 p-3">
            <p className="text-sm text-amber-900">
              <strong>Solicitante:</strong> {tk?.solicitante_nome} ({tk?.solicitante_email})
            </p>
            <p className="text-sm text-amber-900 mt-1">
              <strong>Motivo:</strong> {tk?.motivo}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Cliente" value={pv?.nome_cliente} />
            <Field label="CNPJ" value={pv?.cnpj_cliente} />
            <Field label="Endereço" value={pv?.endereco} className="col-span-2" />
            <Field label="Produto NT" value={pv?.produto_nt} />
            <Field label="Vigência" value={pv?.vigencia ? `${pv.vigencia} meses` : "—"} />
            <Field label="Ticket Mensal" value={fmtMoney(pv?.ticket_mensal)} />
            <Field label="Valor Mínimo" value={fmtMoney(pv?.valor_minimo)} />
            <Field
              label="Previsão ROI"
              value={pv?.previsao_roi != null ? Number(pv.previsao_roi).toFixed(2).replace(".", ",") : "—"}
            />
            {(() => {
              const { roiEscolhido } = getRoiIndicators(pv?.dados_precificacao);
              if (roiEscolhido == null) return null;
              return (
                <Field
                  label="ROI Limite Calculado (ROI máximo aceito para esse projeto)"
                  value={Number(roiEscolhido).toFixed(2).replace(".", ",")}
                />
              );
            })()}
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-sm font-medium">Comentário (opcional)</label>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Adicione um comentário sobre sua decisão..."
              rows={3}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant={acaoEscolhida === "reprovar" ? "destructive" : "outline"}
              className="flex-1"
              onClick={() => setAcaoEscolhida("reprovar")}
              disabled={submitting}
            >
              <XCircle className="h-4 w-4 mr-2" /> Reprovar
            </Button>
            <Button
              className={`flex-1 ${acaoEscolhida === "aprovar" ? "bg-green-600 hover:bg-green-700" : ""}`}
              variant={acaoEscolhida === "aprovar" ? "default" : "outline"}
              onClick={() => setAcaoEscolhida("aprovar")}
              disabled={submitting}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
            </Button>
          </div>

          <Button
            className="w-full"
            onClick={submit}
            disabled={!acaoEscolhida || submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Clock className="h-4 w-4 mr-2" />
            )}
            Confirmar decisão
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, className = "" }: { label: string; value: any; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
