import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isWs = location.pathname.startsWith("/ws");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Informe seu e-mail"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("E-mail inválido"); return; }
    setError("");
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSent(true);
    } catch {
      // still show success for security
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  const loginPath = isWs ? "/ws/login" : "/auth";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Recuperar Senha</CardTitle>
          <CardDescription>
            {sent
              ? "Verifique sua caixa de entrada"
              : "Informe seu e-mail para receber o link de recuperação"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Se este e-mail estiver cadastrado, você receberá um link em instantes.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate(loginPath)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  className={error ? "border-destructive" : ""}
                />
                {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
              <button
                type="button"
                onClick={() => navigate(loginPath)}
                className="flex items-center justify-center gap-1.5 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao login
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
