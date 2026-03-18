import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, RefreshCw, Shield, ShieldOff, KeyRound, Loader2, Users, Wifi, Clock, ArrowLeftRight, Eye } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { UserSearchInput } from "@/components/ws-users/UserSearchInput";
import { UserDetailModal } from "@/components/ws-users/UserDetailModal";

interface ManagedUser {
  id: string;
  email: string;
  display_name: string;
  is_active?: boolean;
  created_at: string;
}

function invokeManageUsers(action: string, params: Record<string, any> = {}) {
  return supabase.functions.invoke("manage-ws-users", {
    body: { action, ...params },
  });
}

function filterUsers(users: ManagedUser[] | undefined, search: string) {
  if (!users || !search.trim()) return users;
  const q = search.toLowerCase();
  return users.filter(
    (u) =>
      u.display_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
  );
}

function formatDate(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return "—"; }
}

/* ── Pending Users ── */
function PendingUserList({ globalSearch }: { globalSearch: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [detailUser, setDetailUser] = useState<ManagedUser | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["managed-users", "pending"],
    queryFn: async () => {
      const { data, error } = await invokeManageUsers("list_pending_users");
      if (error) throw error;
      return (data as any).users as ManagedUser[];
    },
  });

  const filtered = useMemo(() => filterUsers(users, search), [users, search]);

  const assignRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) => {
      const { data, error } = await invokeManageUsers("assign_role", { user_id, role });
      if (error) throw error;
      if ((data as any).error) throw new Error((data as any).error);
    },
    onSuccess: (_, vars) => {
      toast({ title: `Papel ${vars.role === "admin" ? "Admin" : "WS"} atribuído!` });
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Clock className="h-5 w-5" /> Usuários Pendentes
      </h2>
      <p className="text-sm text-muted-foreground">
        Usuários que se cadastraram mas ainda não possuem um papel definido.
      </p>
      <UserSearchInput value={search} onChange={setSearch} />

      {isLoading ? (
        <div className="flex justify-center py-6">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !filtered?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {search ? "Nenhum resultado encontrado." : "Nenhum usuário pendente."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setDetailUser(u)} className="text-left min-w-0 hover:opacity-80 transition-opacity">
                    <p className="font-medium text-sm truncate">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </button>
                  <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">{formatDate(u.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">Sem papel</Badge>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setDetailUser(u)}>
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button variant="default" size="sm" className="gap-1 text-xs h-7"
                    onClick={() => assignRole.mutate({ user_id: u.id, role: "ws_user" })}
                    disabled={assignRole.isPending}>
                    <Wifi className="h-3 w-3" /> WS
                  </Button>
                  <Button variant="secondary" size="sm" className="gap-1 text-xs h-7"
                    onClick={() => assignRole.mutate({ user_id: u.id, role: "admin" })}
                    disabled={assignRole.isPending}>
                    <Users className="h-3 w-3" /> Admin
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <UserDetailModal user={detailUser} role="pending" open={!!detailUser} onOpenChange={(o) => !o && setDetailUser(null)} />
    </div>
  );
}

/* ── Role-based User List ── */
function UserList({ role, label, icon: Icon }: { role: "ws_user" | "admin"; label: string; icon: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [resetOpen, setResetOpen] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [search, setSearch] = useState("");
  const [detailUser, setDetailUser] = useState<ManagedUser | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["managed-users", role],
    queryFn: async () => {
      const { data, error } = await invokeManageUsers("list_users", { role });
      if (error) throw error;
      return (data as any).users as ManagedUser[];
    },
  });

  const filtered = useMemo(() => filterUsers(users, search), [users, search]);

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeManageUsers("create_user", {
        email: newEmail, password: newPassword, display_name: newName || newEmail, role,
      });
      if (error) throw error;
      if ((data as any).error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: `Usuário ${label} criado com sucesso!` });
      queryClient.invalidateQueries({ queryKey: ["managed-users", role] });
      setCreateOpen(false); setNewEmail(""); setNewPassword(""); setNewName("");
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    },
  });

  const toggleUser = useMutation({
    mutationFn: async ({ user_id, is_active }: { user_id: string; is_active: boolean }) => {
      const { data, error } = await invokeManageUsers("toggle_user", { user_id, is_active, role });
      if (error) throw error;
      if ((data as any).error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-users", role] });
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
      toast({ title: "Senha redefinida!" }); setResetOpen(null); setResetPassword("");
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ user_id }: { user_id: string }) => {
      const toRole = role === "ws_user" ? "admin" : "ws_user";
      const { data, error } = await invokeManageUsers("change_role", { user_id, from_role: role, to_role: toRole });
      if (error) throw error;
      if ((data as any).error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      const toLabel = role === "ws_user" ? "Admin" : "WS";
      toast({ title: `Usuário alterado para ${toLabel}!` });
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Icon className="h-5 w-5" /> Usuários {label}
        </h2>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><UserPlus className="h-4 w-4" /> Novo {label}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Usuário {label}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createUser.mutate(); }} className="space-y-4">
              <Input placeholder="Nome (opcional)" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              <Input type="password" placeholder="Senha (mín. 6 caracteres)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
              <Button type="submit" className="w-full" disabled={createUser.isPending}>
                {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Criar Usuário
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <UserSearchInput value={search} onChange={setSearch} />

      {isLoading ? (
        <div className="flex justify-center py-6"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !filtered?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          {search ? "Nenhum resultado encontrado." : `Nenhum usuário ${label} cadastrado.`}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setDetailUser(u)} className="text-left min-w-0 hover:opacity-80 transition-opacity">
                    <p className="font-medium text-sm truncate">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </button>
                  <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">{formatDate(u.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={u.is_active ? "default" : "secondary"} className="text-xs">
                    {u.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setDetailUser(u)}>
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleUser.mutate({ user_id: u.id, is_active: !u.is_active })} className="gap-1 text-xs h-7">
                    {u.is_active ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                    {u.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-7"
                    onClick={() => changeRole.mutate({ user_id: u.id })}
                    disabled={changeRole.isPending}>
                    <ArrowLeftRight className="h-3 w-3" />
                    {role === "ws_user" ? "→ Admin" : "→ WS"}
                  </Button>
                  <Dialog open={resetOpen === u.id} onOpenChange={(o) => { setResetOpen(o ? u.id : null); setResetPassword(""); }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1 text-xs h-7"><KeyRound className="h-3 w-3" /> Senha</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Resetar senha de {u.email}</DialogTitle></DialogHeader>
                      <form onSubmit={(e) => { e.preventDefault(); resetPwd.mutate({ user_id: u.id, new_password: resetPassword }); }} className="space-y-4">
                        <Input type="password" placeholder="Nova senha (mín. 6 caracteres)" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required minLength={6} />
                        <Button type="submit" className="w-full" disabled={resetPwd.isPending}>
                          {resetPwd.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Confirmar
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
      <UserDetailModal user={detailUser} role={role} open={!!detailUser} onOpenChange={(o) => !o && setDetailUser(null)} />
    </div>
  );
}

export default function WsUsersPage() {
  const { data: wsList } = useQuery({
    queryKey: ["managed-users", "ws_user"],
    queryFn: async () => {
      const { data, error } = await invokeManageUsers("list_users", { role: "ws_user" });
      if (error) throw error;
      return (data as any).users as ManagedUser[];
    },
  });
  const { data: adminList } = useQuery({
    queryKey: ["managed-users", "admin"],
    queryFn: async () => {
      const { data, error } = await invokeManageUsers("list_users", { role: "admin" });
      if (error) throw error;
      return (data as any).users as ManagedUser[];
    },
  });
  const { data: pendingList } = useQuery({
    queryKey: ["managed-users", "pending"],
    queryFn: async () => {
      const { data, error } = await invokeManageUsers("list_pending_users");
      if (error) throw error;
      return (data as any).users as ManagedUser[];
    },
  });

  const wsCount = wsList?.length ?? 0;
  const adminCount = adminList?.length ?? 0;
  const pendingCount = pendingList?.length ?? 0;
  const total = wsCount + adminCount;

  const [globalSearch, setGlobalSearch] = useState("");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">
        Gestão de Usuários
        <span className="text-sm font-normal text-muted-foreground ml-2">· {total} usuários</span>
      </h1>
      <UserSearchInput value={globalSearch} onChange={setGlobalSearch} />
      <Tabs defaultValue="ws">
        <TabsList>
          <TabsTrigger value="ws" className="gap-2"><Wifi className="h-3.5 w-3.5" /> Usuários WS ({wsCount})</TabsTrigger>
          <TabsTrigger value="admin" className="gap-2"><Users className="h-3.5 w-3.5" /> Administradores ({adminCount})</TabsTrigger>
          <TabsTrigger value="pending" className="gap-2"><Clock className="h-3.5 w-3.5" /> Pendentes ({pendingCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="ws" className="mt-4">
          <UserList role="ws_user" label="WS" icon={Wifi} globalSearch={globalSearch} />
        </TabsContent>
        <TabsContent value="admin" className="mt-4">
          <UserList role="admin" label="Admin" icon={Users} globalSearch={globalSearch} />
        </TabsContent>
        <TabsContent value="pending" className="mt-4">
          <PendingUserList globalSearch={globalSearch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
