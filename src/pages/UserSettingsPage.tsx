import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Save, X, Eye, EyeOff, Camera, Trash2 } from "lucide-react";

function getInitials(displayName?: string | null, fullName?: string | null, email?: string | null) {
  const name = displayName || fullName || email?.split("@")[0] || "?";
  return name
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function phoneMask(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function UserSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Profile state
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Original values for cancel
  const [origDisplayName, setOrigDisplayName] = useState("");
  const [origFullName, setOrigFullName] = useState("");
  const [origPhone, setOrigPhone] = useState("");

  // Saving
  const [savingProfile, setSavingProfile] = useState(false);
  const [fullNameError, setFullNameError] = useState("");

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwErrors, setPwErrors] = useState<{ current?: string; new?: string; confirm?: string }>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, full_name, phone, avatar_url")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setFullName((data as any).full_name ?? "");
        setPhone((data as any).phone ?? "");
        setAvatarUrl((data as any).avatar_url ?? null);
        setOrigDisplayName(data.display_name ?? "");
        setOrigFullName((data as any).full_name ?? "");
        setOrigPhone((data as any).phone ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  const profileChanged =
    displayName !== origDisplayName || fullName !== origFullName || phone !== origPhone;

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: publicUrl } as any).eq("user_id", user.id);
      setAvatarUrl(publicUrl);
      window.dispatchEvent(new Event("profile-updated"));
      toast({ title: "Foto atualizada!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar foto", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      setFullNameError("Nome Completo é obrigatório");
      return;
    }
    setFullNameError("");
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        } as any)
        .eq("user_id", user!.id);
      if (error) throw error;
      setOrigDisplayName(displayName);
      setOrigFullName(fullName);
      setOrigPhone(phone);
      toast({ title: "Perfil salvo com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelProfile = () => {
    setDisplayName(origDisplayName);
    setFullName(origFullName);
    setPhone(origPhone);
    setFullNameError("");
  };

  const handleChangePassword = async () => {
    const errors: typeof pwErrors = {};
    if (!currentPw) errors.current = "Informe a senha atual";
    if (newPw.length < 8) errors.new = "Mínimo 8 caracteres";
    if (newPw !== confirmPw) errors.confirm = "As senhas não coincidem";
    setPwErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingPw(true);
    try {
      // Verify current password by re-signing in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPw,
      });
      if (signInErr) {
        setPwErrors({ current: "Senha atual incorreta" });
        setSavingPw(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwErrors({});
      toast({ title: "Senha alterada com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao alterar senha", description: err.message, variant: "destructive" });
    } finally {
      setSavingPw(false);
    }
  };

  const pwChanged = currentPw || newPw || confirmPw;

  const handleCancelPw = () => {
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwErrors({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Configurações da Conta</h1>

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Foto de Perfil</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative group">
            <Avatar className="h-20 w-20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                {getInitials(displayName, fullName, user?.email)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadAvatar}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Clique na foto para alterar</p>
            <p className="text-xs">JPG, PNG ou WebP. Máx 5MB.</p>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome de Exibição (Apelido)</Label>
              <Input
                placeholder="Opcional"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Nome Completo <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Nome completo"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (e.target.value.trim()) setFullNameError("");
                }}
                className={fullNameError ? "border-destructive" : ""}
              />
              {fullNameError && (
                <p className="text-xs text-destructive">{fullNameError}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="(XX) XXXXX-XXXX"
                value={phone}
                onChange={(e) => setPhone(phoneMask(e.target.value))}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="gap-2" onClick={handleSaveProfile} disabled={!profileChanged || savingProfile}>
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Alterações
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleCancelProfile} disabled={!profileChanged}>
              <X className="h-4 w-4" /> Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Senha Atual", value: currentPw, set: setCurrentPw, show: showCurrentPw, toggle: setShowCurrentPw, error: pwErrors.current },
            { label: "Nova Senha", value: newPw, set: setNewPw, show: showNewPw, toggle: setShowNewPw, error: pwErrors.new },
            { label: "Confirmar Nova Senha", value: confirmPw, set: setConfirmPw, show: showConfirmPw, toggle: setShowConfirmPw, error: pwErrors.confirm },
          ].map((f) => (
            <div key={f.label} className="space-y-2 max-w-sm">
              <Label>{f.label}</Label>
              <div className="relative">
                <Input
                  type={f.show ? "text" : "password"}
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
          <div className="flex gap-2 pt-2">
            <Button className="gap-2" onClick={handleChangePassword} disabled={!pwChanged || savingPw}>
              {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Alterações
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleCancelPw} disabled={!pwChanged}>
              <X className="h-4 w-4" /> Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
