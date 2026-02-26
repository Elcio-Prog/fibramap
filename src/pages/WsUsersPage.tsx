import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, RefreshCw, Shield, ShieldOff, KeyRound, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface WsUser {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

function invokeManageUsers(action: string, params: Record<string, any> = {}) {
  return supabase.functions.invoke("manage-ws-users", {
    body: { action, ...params },
  });
}

export default function WsUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [resetOpen, setResetOpen] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["ws-users"],
    queryFn: async () => {
      const { data, error } = await invokeManageUsers("list_users");
      if (error) throw error;
      return (data as any).users as WsUser[];
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeManageUsers("create_user", {
        email: newEmail,
        password: newPassword,
        display_name: newName || newEmail,
      });
      if (error) throw error;
      if ((data as any).error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Usuário WS criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["ws-users"] });
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    },
  });

  const toggleUser = useMutation({
    mutationFn: async ({ user_id, is_active }: { user_id: string; is_active: boolean }) => {
      const { data, error } = await invokeManageUsers("toggle_user", { user_id, is_active });
      if (error) throw error;
      if ((data as any).error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ws-users"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const resetPwd = useMutation({
    mutationFn: async ({ user_id, new_password }: { user_id: string; new_password: string }) => {
      const { data, error } = await invokeManageUsers("reset_password", { user_id, new_password });
      if (error) throw error;
      if ((data as any).error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast({ title: "Senha redefinida!" });
      setResetOpen(null);
      setResetPassword("");
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuários WS</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" /> Novo Usuário WS
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Usuário WS</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUser.mutate();
              }}
              className="space-y-4"
            >
              <Input placeholder="Nome (opcional)" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              <Input type="password" placeholder="Senha (mín. 6 caracteres)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
              <Button type="submit" className="w-full" disabled={createUser.isPending}>
                {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Criar Usuário
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !users?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum usuário WS cadastrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{u.display_name}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={u.is_active ? "default" : "secondary"}>
                    {u.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleUser.mutate({ user_id: u.id, is_active: !u.is_active })}
                    className="gap-1"
                  >
                    {u.is_active ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                    {u.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Dialog open={resetOpen === u.id} onOpenChange={(o) => { setResetOpen(o ? u.id : null); setResetPassword(""); }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <KeyRound className="h-3.5 w-3.5" /> Resetar senha
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Resetar senha de {u.email}</DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          resetPwd.mutate({ user_id: u.id, new_password: resetPassword });
                        }}
                        className="space-y-4"
                      >
                        <Input type="password" placeholder="Nova senha (mín. 6 caracteres)" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required minLength={6} />
                        <Button type="submit" className="w-full" disabled={resetPwd.isPending}>
                          {resetPwd.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                          Confirmar
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
