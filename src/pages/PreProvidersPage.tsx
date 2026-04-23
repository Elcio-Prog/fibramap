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
import { Plus, Trash2, Pencil, MapPin, ArrowUpRight, Building2, Eye, Upload, Search, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

// Format CNPJ as 00.000.000/0000-00
function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

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
    cnpj: "",
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
      cnpj: "", nome_fantasia: "", razao_social: "", cidade_sede: "", estado_sede: "",
      has_cross_ntt: false, oferece_mancha: "NÃO",
      contato_comercial_nome: "", contato_comercial_fone: "", contato_comercial_email: "",
      contato_noc_nome: "", contato_noc_fone: "", contato_noc_email: "", observacoes: "",
    });
  };

  const handleCreate = async () => {
    if (!form.nome_fantasia.trim()) return;
    try {
      await createPreProvider.mutateAsync({
        cnpj: form.cnpj.trim() || null,
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
      } as any);
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
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const { toast } = useToast();

  const lookupCnpj = async () => {
    const digits = (form.cnpj || "").replace(/\D/g, "");
    if (digits.length !== 14) {
      toast({ title: "CNPJ inválido", description: "Digite os 14 dígitos do CNPJ", variant: "destructive" });
      return;
    }
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "CNPJ não encontrado");
      }
      const data = await res.json();
      // Map BrasilAPI fields → form
      setForm({
        ...form,
        cnpj: formatCnpj(digits),
        razao_social: data.razao_social || form.razao_social,
        nome_fantasia: data.nome_fantasia || data.razao_social || form.nome_fantasia,
        cidade_sede: data.municipio || form.cidade_sede,
        estado_sede: data.uf || form.estado_sede,
        contato_comercial_fone:
          form.contato_comercial_fone ||
          (data.ddd_telefone_1 ? data.ddd_telefone_1 : "") ||
          "",
        contato_comercial_email: form.contato_comercial_email || data.email || "",
      });
      toast({ title: "Dados carregados", description: data.razao_social });
    } catch (err: any) {
      toast({ title: "Erro ao buscar CNPJ", description: err.message, variant: "destructive" });
    } finally {
      setCnpjLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-muted-foreground">Identificação</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <Label>CNPJ</Label>
          <div className="flex gap-2">
            <Input
              value={form.cnpj || ""}
              onChange={e => update("cnpj", formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); lookupCnpj(); } }}
            />
            <Button type="button" variant="outline" onClick={lookupCnpj} disabled={cnpjLoading} className="shrink-0">
              {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1">Buscar</span>
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Preenche automaticamente os campos via BrasilAPI</p>
        </div>
      </div>

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
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!cidade.trim()) return;
    await addCity.mutateAsync({ pre_provider_id: preProviderId, cidade: cidade.trim(), estado: estado.trim() || undefined });
    setCidade("");
    setEstado("");
    toast({ title: "Cidade adicionada" });
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (rows.length === 0) {
        toast({ title: "Planilha vazia", variant: "destructive" });
        return;
      }

      // Try to find cidade/uf columns (flexible matching)
      const headers = Object.keys(rows[0]);
      const cidadeCol = headers.find(h => /cidade/i.test(h)) || headers[0];
      const ufCol = headers.find(h => /uf|estado|sigla/i.test(h));

      const existingSet = new Set(
        (cities || []).map(c => `${c.cidade.trim().toUpperCase()}|${(c.estado || "").trim().toUpperCase()}`)
      );

      let added = 0;
      let skipped = 0;

      for (const row of rows) {
        const cidadeVal = String(row[cidadeCol] || "").trim();
        if (!cidadeVal) continue;
        const estadoVal = ufCol ? String(row[ufCol] || "").trim() : "";
        const key = `${cidadeVal.toUpperCase()}|${estadoVal.toUpperCase()}`;

        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        await addCity.mutateAsync({
          pre_provider_id: preProviderId,
          cidade: cidadeVal,
          estado: estadoVal || undefined,
        });
        existingSet.add(key);
        added++;
      }

      toast({
        title: "Importação concluída",
        description: `${added} cidade(s) adicionada(s)${skipped > 0 ? `, ${skipped} já existente(s)` : ""}`,
      });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={importing}
              onClick={() => document.getElementById(`city-excel-${preProviderId}`)?.click()}
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importando..." : "Importar Excel"}
            </Button>
            <input
              id={`city-excel-${preProviderId}`}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleExcelImport}
            />
            <span className="text-xs text-muted-foreground">Colunas: Cidade, UF (opcional)</span>
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
