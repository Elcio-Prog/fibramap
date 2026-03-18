import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ new?: string; confirm?: string }>({});
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Listen for the SIGNED_IN event with type=recovery from the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
    // Also check hash immediately
    if (window.location.hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (newPw.length < 8) errs.new = "Mínimo 8 caracteres";
    if (newPw !== confirmPw) errs.confirm = "As senhas não coincidem";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast({ title: "Senha redefinida com sucesso!" });
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Link inválido ou expirado. Solicite um novo link de recuperação.
            <Button variant="outline" className="mt-4 w-full" onClick={() => navigate("/auth")}>
              Voltar ao login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
          <CardDescription>Escolha uma nova senha para sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: "Nova Senha", value: newPw, set: setNewPw, show: showNew, toggle: setShowNew, error: errors.new },
              { label: "Confirmar Nova Senha", value: confirmPw, set: setConfirmPw, show: showConfirm, toggle: setShowConfirm, error: errors.confirm },
            ].map((f) => (
              <div key={f.label} className="space-y-1">
                <div className="relative">
                  <Input
                    type={f.show ? "text" : "password"}
                    placeholder={f.label}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className={f.error ? "border-destructive pr-10" : "pr-10"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => f.toggle(!f.show)}
                  >
                    {f.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {f.error && <p className="text-xs text-destructive">{f.error}</p>}
              </div>
            ))}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Redefinir Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
