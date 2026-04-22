import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

interface UserDetailModalProps {
  user: { id: string; email: string; display_name: string; created_at: string; is_active?: boolean } | null;
  role?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(/[\s._-]+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function UserDetailModal({ user, role, open, onOpenChange }: UserDetailModalProps) {
  const { data: profile } = useQuery({
    queryKey: ["user-profile-detail", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!user) return null;

  const avatarUrl = profile?.avatar_url || null;
  const displayName = profile?.display_name || user.display_name;
  const fullName = profile?.full_name || null;
  const phone = profile?.phone || null;
  const createdAt = user.created_at ? format(new Date(user.created_at), "dd/MM/yyyy") : "—";

  const roleLabel =
    role === "admin" ? "Administrador" :
    role === "ws_user" ? "Usuário WS" :
    role === "vendedor" ? "Vendedor" :
    role === "implantacao" ? "Validação" :
    role === "lm" ? "Last Mile" :
    role === "bko" ? "BKO" :
    "Pendente";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do Usuário</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <Avatar className="h-20 w-20">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="text-xl">{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <p className="text-lg font-semibold">{displayName}</p>
            {fullName && fullName !== displayName && (
              <p className="text-sm text-muted-foreground">{fullName}</p>
            )}
          </div>
          <Badge variant={user.is_active === false ? "secondary" : "default"}>{roleLabel}</Badge>
        </div>
        <Separator />
        <div className="space-y-3 py-2">
          <DetailRow label="Email" value={user.email} />
          <DetailRow label="Telefone" value={phone || "Não informado"} />
          <DetailRow label="Data de cadastro" value={createdAt} />
          <DetailRow label="Status" value={user.is_active === false ? "Inativo" : "Ativo"} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
