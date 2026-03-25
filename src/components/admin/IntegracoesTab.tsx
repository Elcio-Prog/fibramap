import { useState } from "react";
import { useIntegracoes, Integracao } from "@/hooks/useIntegracoes";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Save, Plus, Trash2, Eye, EyeOff, Pencil, Link2 } from "lucide-react";

export default function IntegracoesTab() {
  const { integracoes, isLoading, createIntegracao, updateIntegracao, deleteIntegracao } = useIntegracoes();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Integracao | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [tipo, setTipo] = useState("webhook");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [showToken, setShowToken] = useState(false);

  const resetForm = () => {
    setNome(""); setUrl(""); setToken(""); setTipo("webhook"); setDescricao(""); setAtivo(true); setShowToken(false);
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setFormOpen(true); };

  const openEdit = (item: Integracao) => {
    setEditing(item);
    setNome(item.nome);
    setUrl(item.url);
    setToken(item.token);
    setTipo(item.tipo);
    setDescricao(item.descricao || "");
    setAtivo(item.ativo);
    setShowToken(false);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim() || !url.trim()) {
      toast({ title: "Nome e URL são obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const values = { nome: nome.trim(), url: url.trim(), token: token.trim(), tipo, descricao: descricao.trim(), ativo };
      if (editing) {
        await updateIntegracao.mutateAsync({ id: editing.id, ...values });
        toast({ title: "Integração atualizada!" });
      } else {
        await createIntegracao.mutateAsync(values);
        toast({ title: "Integração criada!" });
      }
      setFormOpen(false);
      resetForm();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteIntegracao.mutateAsync(deletingId);
      toast({ title: "Integração removida!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setDeleteOpen(false);
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Webhooks & Integrações</CardTitle>
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova Integração
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {integracoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma integração adicional cadastrada. Clique em "Nova Integração" para adicionar.
            </p>
          ) : (
            <div className="space-y-3">
              {integracoes.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Link2 className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{item.nome}</span>
                        <Badge variant="secondary" className="text-xs">{item.tipo}</Badge>
                        {item.ativo ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Ativo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Inativo</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{item.url}</p>
                      {item.descricao && (
                        <p className="text-xs text-muted-foreground truncate">{item.descricao}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => { setDeletingId(item.id); setDeleteOpen(true); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) { setFormOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Integração" : "Nova Integração"}</DialogTitle>
            <DialogDescription>
              {editing ? "Atualize os dados da integração." : "Preencha os dados para adicionar uma nova integração."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Power Automate - Comercial" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input placeholder="webhook" value={tipo} onChange={(e) => setTipo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input type="url" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Token de Autenticação</Label>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder="Bearer token..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea placeholder="Descrição opcional..." value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>Cancelar</Button>
            <Button className="gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Integração</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir esta integração? Essa ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
