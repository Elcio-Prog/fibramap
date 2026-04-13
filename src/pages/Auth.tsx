import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Network, Wifi, Lock, ArrowLeft } from "lucide-react";

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();
  const isWsLogin = location.pathname === "/ws/login";

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // If logging in via /auth (admin), check if user has admin role
        if (!isWsLogin && data.user) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.user.id)
            .eq("is_active", true);

          const hasAdmin = roles?.some((r: any) => r.role === "admin");
          if (!hasAdmin) {
            await supabase.auth.signOut();
            toast({
              title: "Acesso negado",
              description: "Você não tem permissão para acessar o painel administrativo.",
              variant: "destructive",
            });
            return;
          }
        }
      } else {
        // Signup only available for WS
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: "Conta criada!", description: "Verifique seu email para confirmar o cadastro." });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const icon = isWsLogin ? <Wifi className="h-6 w-6" /> : <Network className="h-6 w-6" />;
  const title = isWsLogin ? "FibraMap - Usuários" : "FibraMap";
  const subtitle = isLogin
    ? "Entre na sua conta"
    : "Crie sua conta";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      {/* Back to landing */}
      <button
        onClick={() => navigate("/landing")}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar à seleção
      </button>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div
            className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl ${
              isWsLogin
                ? "bg-accent text-accent-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {icon}
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>

          {/* Admin-only badge */}
          {!isWsLogin && (
            <div className="mx-auto mt-2 flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <Lock className="h-3 w-3" />
              Acesso restrito — somente administradores
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display name field — only for WS signup */}
            {!isLogin && isWsLogin && (
              <Input
                placeholder="Nome"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div>
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              {isLogin && (
                <div className="mt-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => navigate(isWsLogin ? "/ws/forgot-password" : "/forgot-password")}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Esqueci a senha
                  </button>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Carregando..." : isLogin ? "Entrar" : "Cadastrar"}
            </Button>
          </form>

          {/* Toggle signup — ONLY for WS login */}
          {isWsLogin && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary underline-offset-4 hover:underline"
              >
                {isLogin ? "Cadastre-se" : "Entrar"}
              </button>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
