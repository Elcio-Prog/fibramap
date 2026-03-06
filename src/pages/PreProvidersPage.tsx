import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import {
  usePreProviders,
  useCreatePreProvider,
  useUpdatePreProvider,
  useDeletePreProvider,
  usePreProviderCities,
  useAddPreProviderCity,
  useDeletePreProviderCity,
  usePromotePreProvider,
  PreProvider,
} from "@/hooks/usePreProviders";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, MapPin, ArrowUpRight, Building2, Eye, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

export default function PreProvidersPage() {
  const { data: preProviders, isLoading } = usePreProviders();
  const { isAdmin } = useUserRole();
  const createPreProvider = useCreatePreProvider();
  const deletePreProvider = useDeletePreProvider();
  const promotePreProvider = usePromotePreProvider();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editProvider, setEditProvider] = useState<PreProvider | null>(null);
  const [citiesProviderId, setCitiesProviderId] = useState<string | null>(null);
  const [detailProvider, setDetailProvider] = useState<PreProvider | null>(null);

  // Form state
  const [form, setForm] = useState({
    nome_fantasia: "",
    razao_social: "",
    cidade_sede: "",
    estado_sede: "",
    has_cross_ntt: false,
    oferece_mancha: "NÃO",
    contato_comercial_nome: "",
    contato_comercial_fone: "",
    contato_comercial_email: "",
    contato_noc_nome: "",
    contato_noc_fone: "",
    contato_noc_email: "",
    observacoes: "",
  });

  const resetForm = () => {
    setForm({
      nome_fantasia: "", razao_social: "", cidade_sede: "", estado_sede: "",
      has_cross_ntt: false, oferece_mancha: "NÃO",
      contato_comercial_nome: "", contato_comercial_fone: "", contato_comercial_email: "",
      contato_noc_nome: "", contato_noc_fone: "", contato_noc_email: "", observacoes: "",
    });
  };

  const handleCreate = async () => {
    if (!form.nome_fantasia.trim()) return;
    try {
      await createPreProvider.mutateAsync({
        nome_fantasia: form.nome_fantasia.trim(),
        razao_social: form.razao_social.trim() || null,
        cidade_sede: form.cidade_sede.trim() || null,
        estado_sede: form.estado_sede.trim() || null,
        has_cross_ntt: form.has_cross_ntt,
        oferece_mancha: form.oferece_mancha || "NÃO",
        contato_comercial_nome: form.contato_comercial_nome.trim() || null,
        contato_comercial_fone: form.contato_comercial_fone.trim() || null,
        contato_comercial_email: form.contato_comercial_email.trim() || null,
        contato_noc_nome: form.contato_noc_nome.trim() || null,
        contato_noc_fone: form.contato_noc_fone.trim() || null,
        contato_noc_email: form.contato_noc_email.trim() || null,
        observacoes: form.observacoes.trim() || null,
      });
      resetForm();
      setShowForm(false);
      toast({ title: "Pré-cadastro criado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handlePromote = async (pp: PreProvider) => {
    if (!confirm(`Promover "${pp.nome_fantasia}" para cadastro principal? Ele ficará disponível para upload de rede/mancha.`)) return;
    try {
      await promotePreProvider.mutateAsync(pp);
      toast({ title: "Provedor promovido!", description: `${pp.nome_fantasia} agora está no cadastro principal.` });
    } catch (err: any) {
      toast({ title: "Erro ao promover", description: err.message, variant: "destructive" });
    }
  };

  const activePreProviders = preProviders?.filter(p => p.status === "pre_cadastro") || [];
  const promotedPreProviders = preProviders?.filter(p => p.status === "promovido") || [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Pré-Cadastro de Provedores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provedores pré-cadastrados participam das buscas por cidade. Promova para cadastro principal quando a mancha/rede estiver disponível.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Pré-Cadastro
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6">
            <ProviderForm form={form} setForm={setForm} />
            <div className="mt-4 flex gap-2">
              <Button onClick={handleCreate} disabled={createPreProvider.isPending}>Salvar</Button>
              <Button variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active pre-providers */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            Pré-cadastrados <Badge variant="secondary">{activePreProviders.length}</Badge>
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome Fantasia</TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>Cidade Sede</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Cross NTT</TableHead>
                  <TableHead>Mancha</TableHead>
                  <TableHead>Contato Comercial</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePreProviders.map((pp) => (
                  <TableRow key={pp.id}>
                    <TableCell className="font-medium">{pp.nome_fantasia}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{pp.razao_social || "—"}</TableCell>
                    <TableCell>{pp.cidade_sede || "—"}</TableCell>
                    <TableCell>{pp.estado_sede || "—"}</TableCell>
                    <TableCell>{pp.has_cross_ntt ? "Sim" : "Não"}</TableCell>
                    <TableCell>
                      <Badge variant={pp.oferece_mancha === "RECEBIDO" ? "default" : pp.oferece_mancha === "SOLICITADO" ? "secondary" : "outline"}>
                        {pp.oferece_mancha || "NÃO"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {pp.contato_comercial_nome && <span>{pp.contato_comercial_nome} {pp.contato_comercial_fone && `- ${pp.contato_comercial_fone}`}</span>}
                      {!pp.contato_comercial_nome && "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetailProvider(pp)} title="Detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditProvider(pp)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setCitiesProviderId(pp.id)} title="Cidades">
                        <MapPin className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button variant="default" size="icon" onClick={() => handlePromote(pp)} title="Promover para Cadastro Principal" className="bg-green-600 hover:bg-green-700">
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={async () => {
                        if (confirm("Excluir este pré-cadastro?")) {
                          await deletePreProvider.mutateAsync(pp.id);
                          toast({ title: "Pré-cadastro excluído" });
                        }
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {activePreProviders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum pré-cadastro ativo
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Promoted */}
      {promotedPreProviders.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
              Promovidos <Badge variant="outline">{promotedPreProviders.length}</Badge>
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome Fantasia</TableHead>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotedPreProviders.map((pp) => (
                    <TableRow key={pp.id} className="opacity-60">
                      <TableCell className="font-medium">{pp.nome_fantasia}</TableCell>
                      <TableCell>{pp.razao_social || "—"}</TableCell>
                      <TableCell><Badge variant="default">Promovido</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      {editProvider && <EditPreProviderDialog provider={editProvider} onClose={() => setEditProvider(null)} />}

      {/* Cities Dialog */}
      {citiesProviderId && (
        <CitiesDialog
          preProviderId={citiesProviderId}
          providerName={preProviders?.find(p => p.id === citiesProviderId)?.nome_fantasia || ""}
          onClose={() => setCitiesProviderId(null)}
        />
      )}

      {/* Detail Dialog */}
      {detailProvider && <DetailDialog provider={detailProvider} onClose={() => setDetailProvider(null)} />}
    </div>
  );
}

function ProviderForm({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const update = (field: string, value: any) => setForm({ ...form, [field]: value });
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-muted-foreground">Dados da Empresa</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <Label>Nome Fantasia *</Label>
          <Input value={form.nome_fantasia} onChange={e => update("nome_fantasia", e.target.value)} placeholder="Nome do provedor" />
        </div>
        <div className="col-span-2">
          <Label>Razão Social</Label>
          <Input value={form.razao_social} onChange={e => update("razao_social", e.target.value)} placeholder="Razão social" />
        </div>
        <div>
          <Label>Cidade Sede</Label>
          <Input value={form.cidade_sede} onChange={e => update("cidade_sede", e.target.value)} />
        </div>
        <div>
          <Label>UF Sede</Label>
          <Input value={form.estado_sede} onChange={e => update("estado_sede", e.target.value)} maxLength={2} />
        </div>
        <div>
          <Label>Cross NTT</Label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.has_cross_ntt ? "sim" : "nao"} onChange={e => update("has_cross_ntt", e.target.value === "sim")}>
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </div>
        <div>
          <Label>Oferece Mancha</Label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.oferece_mancha} onChange={e => update("oferece_mancha", e.target.value)}>
            <option value="NÃO">NÃO</option>
            <option value="SOLICITADO">SOLICITADO</option>
            <option value="RECEBIDO">RECEBIDO</option>
          </select>
        </div>
      </div>

      <p className="text-xs font-semibold text-muted-foreground mt-4">Contato Comercial</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Nome</Label>
          <Input value={form.contato_comercial_nome} onChange={e => update("contato_comercial_nome", e.target.value)} />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input value={form.contato_comercial_fone} onChange={e => update("contato_comercial_fone", e.target.value)} />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input value={form.contato_comercial_email} onChange={e => update("contato_comercial_email", e.target.value)} />
        </div>
      </div>

      <p className="text-xs font-semibold text-muted-foreground mt-4">Contato NOC</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Nome</Label>
          <Input value={form.contato_noc_nome} onChange={e => update("contato_noc_nome", e.target.value)} />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input value={form.contato_noc_fone} onChange={e => update("contato_noc_fone", e.target.value)} />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input value={form.contato_noc_email} onChange={e => update("contato_noc_email", e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea value={form.observacoes} onChange={e => update("observacoes", e.target.value)} rows={2} />
      </div>
    </div>
  );
}

function EditPreProviderDialog({ provider, onClose }: { provider: PreProvider; onClose: () => void }) {
  const updatePreProvider = useUpdatePreProvider();
  const { toast } = useToast();
  const [form, setForm] = useState({
    nome_fantasia: provider.nome_fantasia,
    razao_social: provider.razao_social || "",
    cidade_sede: provider.cidade_sede || "",
    estado_sede: provider.estado_sede || "",
    has_cross_ntt: provider.has_cross_ntt,
    oferece_mancha: provider.oferece_mancha || "NÃO",
    contato_comercial_nome: provider.contato_comercial_nome || "",
    contato_comercial_fone: provider.contato_comercial_fone || "",
    contato_comercial_email: provider.contato_comercial_email || "",
    contato_noc_nome: provider.contato_noc_nome || "",
    contato_noc_fone: provider.contato_noc_fone || "",
    contato_noc_email: provider.contato_noc_email || "",
    observacoes: provider.observacoes || "",
  });

  const handleSave = async () => {
    try {
      await updatePreProvider.mutateAsync({
        id: provider.id,
        nome_fantasia: form.nome_fantasia.trim(),
        razao_social: form.razao_social.trim() || null,
        cidade_sede: form.cidade_sede.trim() || null,
        estado_sede: form.estado_sede.trim() || null,
        has_cross_ntt: form.has_cross_ntt,
        oferece_mancha: form.oferece_mancha,
        contato_comercial_nome: form.contato_comercial_nome.trim() || null,
        contato_comercial_fone: form.contato_comercial_fone.trim() || null,
        contato_comercial_email: form.contato_comercial_email.trim() || null,
        contato_noc_nome: form.contato_noc_nome.trim() || null,
        contato_noc_fone: form.contato_noc_fone.trim() || null,
        contato_noc_email: form.contato_noc_email.trim() || null,
        observacoes: form.observacoes.trim() || null,
      });
      toast({ title: "Pré-cadastro atualizado!" });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pré-Cadastro</DialogTitle>
        </DialogHeader>
        <ProviderForm form={form} setForm={setForm} />
        <Button onClick={handleSave} disabled={updatePreProvider.isPending} className="mt-2">Salvar</Button>
      </DialogContent>
    </Dialog>
  );
}

function CitiesDialog({ preProviderId, providerName, onClose }: { preProviderId: string; providerName: string; onClose: () => void }) {
  const { data: cities } = usePreProviderCities(preProviderId);
  const addCity = useAddPreProviderCity();
  const deleteCity = useDeletePreProviderCity();
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!cidade.trim()) return;
    await addCity.mutateAsync({ pre_provider_id: preProviderId, cidade: cidade.trim(), estado: estado.trim() || undefined });
    setCidade("");
    setEstado("");
    toast({ title: "Cidade adicionada" });
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cidades Atendidas - {providerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Cidade" value={cidade} onChange={e => setCidade(e.target.value)} className="flex-1" />
            <Input placeholder="UF" value={estado} onChange={e => setEstado(e.target.value)} className="w-16" maxLength={2} />
            <Button onClick={handleAdd} size="sm"><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cidade</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cities?.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{c.cidade}</TableCell>
                    <TableCell>{c.estado || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteCity.mutateAsync(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!cities || cities.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-4">Nenhuma cidade cadastrada</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">{cities?.length || 0} cidade(s) cadastrada(s)</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ provider, onClose }: { provider: PreProvider; onClose: () => void }) {
  const { data: cities } = usePreProviderCities(provider.id);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{provider.nome_fantasia}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="font-medium">Razão Social:</span> {provider.razao_social || "—"}</div>
            <div><span className="font-medium">Sede:</span> {provider.cidade_sede || "—"}/{provider.estado_sede || "—"}</div>
            <div><span className="font-medium">Cross NTT:</span> {provider.has_cross_ntt ? "Sim" : "Não"}</div>
            <div><span className="font-medium">Mancha:</span> {provider.oferece_mancha || "NÃO"}</div>
          </div>
          <div className="border-t pt-2">
            <p className="font-medium">Contato Comercial</p>
            <p>{provider.contato_comercial_nome || "—"} | {provider.contato_comercial_fone || "—"} | {provider.contato_comercial_email || "—"}</p>
          </div>
          <div className="border-t pt-2">
            <p className="font-medium">Contato NOC</p>
            <p>{provider.contato_noc_nome || "—"} | {provider.contato_noc_fone || "—"} | {provider.contato_noc_email || "—"}</p>
          </div>
          {provider.observacoes && (
            <div className="border-t pt-2">
              <p className="font-medium">Observações</p>
              <p>{provider.observacoes}</p>
            </div>
          )}
          <div className="border-t pt-2">
            <p className="font-medium">Cidades Atendidas ({cities?.length || 0})</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {cities?.map(c => (
                <Badge key={c.id} variant="outline" className="text-xs">{c.cidade}/{c.estado}</Badge>
              ))}
              {(!cities || cities.length === 0) && <span className="text-muted-foreground">Nenhuma cidade</span>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
