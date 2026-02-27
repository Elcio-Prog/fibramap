import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Network, Wifi } from "lucide-react";

type LoginView = "select" | "admin" | "ws";

export default function Auth() {
  const [view, setView] = useState<LoginView>("select");
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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Store chosen view so redirect logic can use it
        if (view === "ws") {
          sessionStorage.setItem("login_view", "ws");
        } else {
          sessionStorage.removeItem("login_view");
        }
      } else {
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

  if (view === "select") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">FibraMap</CardTitle>
            <CardDescription>Selecione o ambiente de acesso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full h-16 text-base gap-3"
              onClick={() => setView("admin")}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/20">
                <Network className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Painel Administrativo</div>
                <div className="text-xs opacity-80">Mapa, Provedores, Viabilidade, Base LM</div>
              </div>
            </Button>
            <Button
              variant="secondary"
              className="w-full h-16 text-base gap-3"
              onClick={() => setView("ws")}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
                <Wifi className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Ferramenta WS</div>
                <div className="text-xs opacity-80">Upload e viabilidade Wholesale</div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isWsView = view === "ws";
  const icon = isWsView ? <Wifi className="h-6 w-6" /> : <Network className="h-6 w-6" />;
  const title = isWsView ? "Ferramenta WS" : "FibraMap";
  const subtitle = isLogin ? "Entre na sua conta" : "Crie sua conta";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl ${isWsView ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}>
            {icon}
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && !isWsView && (
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
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Carregando..." : isLogin ? "Entrar" : "Cadastrar"}
            </Button>
          </form>
          {!isWsView && (
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
          <button
            onClick={() => setView("select")}
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Voltar à seleção
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
