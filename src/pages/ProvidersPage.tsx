import { useState } from "react";
import { useProviders, useCreateProvider, useUpdateProvider, useDeleteProvider, Provider } from "@/hooks/useProviders";
import { useLpuItems, useCreateLpuItem, useDeleteLpuItem } from "@/hooks/useLpuItems";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Package, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

export default function ProvidersPage() {
  const { data: providers, isLoading } = useProviders();
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();
  const deleteProvider = useDeleteProvider();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3388ff");
  const [maxDist, setMaxDist] = useState("500");
  const [multiplier, setMultiplier] = useState("0.33");
  const [gerenteComercial, setGerenteComercial] = useState("");
  const [telefoneGerente, setTelefoneGerente] = useState("");
  const [hasCrossNtt, setHasCrossNtt] = useState(false);
  const [useSaturatedTa, setUseSaturatedTa] = useState(false);

  const [lpuProviderId, setLpuProviderId] = useState<string | null>(null);
  const [editProvider, setEditProvider] = useState<Provider | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createProvider.mutateAsync({
        name: name.trim(),
        color,
        max_lpu_distance_m: parseFloat(maxDist),
        multiplier: parseFloat(multiplier),
        gerente_comercial: gerenteComercial.trim() || null,
        telefone_gerente: telefoneGerente.trim() || null,
        has_cross_ntt: hasCrossNtt,
        use_saturated_ta: useSaturatedTa,
      } as any);
      setName("");
      setColor("#3388ff");
      setMaxDist("500");
      setMultiplier("0.33");
      setGerenteComercial("");
      setTelefoneGerente("");
      setHasCrossNtt(false);
      setUseSaturatedTa(false);
      setShowForm(false);
      toast({ title: "Provedor criado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Provedores</h1>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Provedor
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do provedor" />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex gap-2">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border" />
                  <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
                </div>
              </div>
              <div>
                <Label>Distância máx. LPU (metros)</Label>
                <Input type="number" value={maxDist} onChange={(e) => setMaxDist(e.target.value)} />
              </div>
              <div>
                <Label>Multiplicador (ex: 0.33)</Label>
                <Input type="number" step="0.01" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} />
              </div>
              <div>
                <Label>Gerente Comercial</Label>
                <Input value={gerenteComercial} onChange={(e) => setGerenteComercial(e.target.value)} placeholder="Nome do gerente" />
              </div>
              <div>
                <Label>Telefone do Gerente</Label>
                <Input value={telefoneGerente} onChange={(e) => setTelefoneGerente(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="flex items-center gap-3 col-span-2">
                <Label>Tem Cross com NTT?</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="cross_ntt" checked={hasCrossNtt} onChange={() => setHasCrossNtt(true)} /> Sim
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="cross_ntt" checked={!hasCrossNtt} onChange={() => setHasCrossNtt(false)} /> Não
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-3 col-span-2">
                <Label>Usar TA saturado (sem porta)?</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="use_saturated" checked={useSaturatedTa} onChange={() => setUseSaturatedTa(true)} /> Sim
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="use_saturated" checked={!useSaturatedTa} onChange={() => setUseSaturatedTa(false)} /> Não
                  </label>
                </div>
              </div>
            </div>
            <Button onClick={handleCreate} disabled={createProvider.isPending}>Salvar</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cor</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Dist. Máx (m)</TableHead>
                <TableHead>Multiplicador</TableHead>
                <TableHead>Gerente Comercial</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cross NTT</TableHead>
                <TableHead>TA Saturado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="h-5 w-5 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.max_lpu_distance_m}</TableCell>
                  <TableCell>{p.multiplier}</TableCell>
                  <TableCell>{p.gerente_comercial || "—"}</TableCell>
                  <TableCell>{p.telefone_gerente || "—"}</TableCell>
                  <TableCell>{p.has_cross_ntt ? "Sim" : "Não"}</TableCell>
                  <TableCell>{(p as any).use_saturated_ta ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditProvider(p)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setLpuProviderId(p.id)} title="LPU">
                      <Package className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (confirm("Excluir este provedor?")) {
                          await deleteProvider.mutateAsync(p.id);
                          toast({ title: "Provedor excluído" });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!providers?.length && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhum provedor cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editProvider && (
        <EditProviderDialog provider={editProvider} onClose={() => setEditProvider(null)} />
      )}

      {/* LPU Dialog */}
      {lpuProviderId && (
        <LpuDialog providerId={lpuProviderId} providerName={providers?.find((p) => p.id === lpuProviderId)?.name || ""} onClose={() => setLpuProviderId(null)} />
      )}
    </div>
  );
}

function EditProviderDialog({ provider, onClose }: { provider: Provider; onClose: () => void }) {
  const updateProvider = useUpdateProvider();
  const { toast } = useToast();
  const [name, setName] = useState(provider.name);
  const [color, setColor] = useState(provider.color);
  const [maxDist, setMaxDist] = useState(String(provider.max_lpu_distance_m));
  const [multiplier, setMultiplier] = useState(String(provider.multiplier));
  const [gerenteComercial, setGerenteComercial] = useState(provider.gerente_comercial || "");
  const [telefoneGerente, setTelefoneGerente] = useState(provider.telefone_gerente || "");
  const [hasCrossNtt, setHasCrossNtt] = useState(provider.has_cross_ntt ?? false);
  const [useSaturatedTa, setUseSaturatedTa] = useState((provider as any).use_saturated_ta ?? false);
  const [razaoSocial, setRazaoSocial] = useState((provider as any).razao_social || "");
  const [contatoComEmail, setContatoComEmail] = useState((provider as any).contato_comercial_email || "");
  const [nocNome, setNocNome] = useState((provider as any).contato_noc_nome || "");
  const [nocFone, setNocFone] = useState((provider as any).contato_noc_fone || "");
  const [nocEmail, setNocEmail] = useState((provider as any).contato_noc_email || "");
  const [cidadeSede, setCidadeSede] = useState((provider as any).cidade_sede || "");
  const [estadoSede, setEstadoSede] = useState((provider as any).estado_sede || "");
  const [observacoes, setObservacoes] = useState((provider as any).observacoes || "");

  // Rules state
  const [regrasUsarPorta, setRegrasUsarPorta] = useState((provider as any).regras_usar_porta_disponivel ?? true);
  const [regrasConsiderarTa, setRegrasConsiderarTa] = useState((provider as any).regras_considerar_ta ?? true);
  const [regrasConsiderarCe, setRegrasConsiderarCe] = useState((provider as any).regras_considerar_ce ?? false);
  const [regrasSplitter1x2, setRegrasSplitter1x2] = useState((provider as any).regras_bloquear_splitter_1x2 ?? true);
  const [regrasSplitterDes, setRegrasSplitterDes] = useState((provider as any).regras_bloquear_splitter_des ?? true);
  const [regrasPortasZero, setRegrasPortasZero] = useState((provider as any).regras_bloquear_portas_livres_zero ?? true);
  const [regrasAtendimento, setRegrasAtendimento] = useState((provider as any).regras_bloquear_atendimento_nao_sim ?? true);
  const [regrasRodovia, setRegrasRodovia] = useState((provider as any).regras_bloquear_cruzamento_rodovia ?? true);
  const [regrasCpfl, setRegrasCpfl] = useState((provider as any).regras_habilitar_exclusao_cpfl ?? true);

  const handleSave = async () => {
    try {
      await updateProvider.mutateAsync({
        id: provider.id,
        name: name.trim(),
        color,
        max_lpu_distance_m: parseFloat(maxDist),
        multiplier: parseFloat(multiplier),
        gerente_comercial: gerenteComercial.trim() || null,
        telefone_gerente: telefoneGerente.trim() || null,
        has_cross_ntt: hasCrossNtt,
        use_saturated_ta: useSaturatedTa,
        razao_social: razaoSocial.trim() || null,
        contato_comercial_email: contatoComEmail.trim() || null,
        contato_noc_nome: nocNome.trim() || null,
        contato_noc_fone: nocFone.trim() || null,
        contato_noc_email: nocEmail.trim() || null,
        cidade_sede: cidadeSede.trim() || null,
        estado_sede: estadoSede.trim() || null,
        observacoes: observacoes.trim() || null,
        regras_usar_porta_disponivel: regrasUsarPorta,
        regras_considerar_ta: regrasConsiderarTa,
        regras_considerar_ce: regrasConsiderarCe,
        regras_bloquear_splitter_1x2: regrasSplitter1x2,
        regras_bloquear_splitter_des: regrasSplitterDes,
        regras_bloquear_portas_livres_zero: regrasPortasZero,
        regras_bloquear_atendimento_nao_sim: regrasAtendimento,
        regras_habilitar_exclusao_cpfl: regrasCpfl,
        regras_bloquear_cruzamento_rodovia: regrasRodovia,
      } as any);
      toast({ title: "Provedor atualizado!" });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Provedor</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded border" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div>
            <Label>Distância máx. LPU (m)</Label>
            <Input type="number" value={maxDist} onChange={(e) => setMaxDist(e.target.value)} />
          </div>
          <div>
            <Label>Multiplicador</Label>
            <Input type="number" step="0.01" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} />
          </div>
          <div>
            <Label>Gerente Comercial</Label>
            <Input value={gerenteComercial} onChange={(e) => setGerenteComercial(e.target.value)} placeholder="Nome do gerente" />
          </div>
          <div>
            <Label>Telefone do Gerente</Label>
            <Input value={telefoneGerente} onChange={(e) => setTelefoneGerente(e.target.value)} placeholder="(00) 00000-0000" />
           </div>
           <div className="flex items-center gap-3 col-span-2">
             <Label>Tem Cross com NTT?</Label>
             <div className="flex gap-4">
               <label className="flex items-center gap-1.5 cursor-pointer">
                 <input type="radio" name="edit_cross_ntt" checked={hasCrossNtt} onChange={() => setHasCrossNtt(true)} /> Sim
               </label>
               <label className="flex items-center gap-1.5 cursor-pointer">
                 <input type="radio" name="edit_cross_ntt" checked={!hasCrossNtt} onChange={() => setHasCrossNtt(false)} /> Não
               </label>
             </div>
           </div>
           <div className="flex items-center gap-3 col-span-2">
             <Label>Usar TA saturado (sem porta)?</Label>
             <div className="flex gap-4">
               <label className="flex items-center gap-1.5 cursor-pointer">
                 <input type="radio" name="edit_use_saturated" checked={useSaturatedTa} onChange={() => setUseSaturatedTa(true)} /> Sim
               </label>
               <label className="flex items-center gap-1.5 cursor-pointer">
                 <input type="radio" name="edit_use_saturated" checked={!useSaturatedTa} onChange={() => setUseSaturatedTa(false)} /> Não
               </label>
             </div>
           </div>
         </div>

        {/* Rules Section */}
        <div className="border-t pt-4 mt-2">
          <h3 className="flex items-center gap-2 font-semibold mb-3">
            <Settings2 className="h-4 w-4" /> Regras do Provedor
          </h3>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Configurações de seleção de ponto de conexão e validação de viabilidade.</p>

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Considerar TA (Terminal de Atendimento)</Label>
                <Switch checked={regrasConsiderarTa} onCheckedChange={setRegrasConsiderarTa} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Considerar CE (Caixa de Emenda)</Label>
                <Switch checked={regrasConsiderarCe} onCheckedChange={setRegrasConsiderarCe} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Filtrar por porta disponível (legado)</Label>
                <Switch checked={regrasUsarPorta} onCheckedChange={setRegrasUsarPorta} />
              </div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground mt-3">Regras de Splitter</p>
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Bloquear se splitter 1x2</Label>
                <Switch checked={regrasSplitter1x2} onCheckedChange={setRegrasSplitter1x2} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Bloquear se splitter DES</Label>
                <Switch checked={regrasSplitterDes} onCheckedChange={setRegrasSplitterDes} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Bloquear se portas livres = 0</Label>
                <Switch checked={regrasPortasZero} onCheckedChange={setRegrasPortasZero} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Bloquear se atendimento ≠ "sim"</Label>
                <Switch checked={regrasAtendimento} onCheckedChange={setRegrasAtendimento} />
              </div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground mt-3">Cruzamento de Rodovias / Ferrovias</p>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-normal">Bloquear cruzamento de rodovia/ferrovia</Label>
              <Switch checked={regrasRodovia} onCheckedChange={setRegrasRodovia} />
            </div>

            <p className="text-xs font-semibold text-muted-foreground mt-3">Exclusão CPFL</p>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-normal">Habilitar exclusão CPFL (bloquear rota)</Label>
              <Switch checked={regrasCpfl} onCheckedChange={setRegrasCpfl} />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={updateProvider.isPending} className="mt-2">Salvar</Button>
      </DialogContent>
    </Dialog>
  );
}

function LpuDialog({ providerId, providerName, onClose }: { providerId: string; providerName: string; onClose: () => void }) {
  const { data: items } = useLpuItems(providerId);
  const createItem = useCreateLpuItem();
  const deleteItem = useDeleteLpuItem();
  const [linkType, setLinkType] = useState("");
  const [value, setValue] = useState("");
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!linkType.trim() || !value) return;
    await createItem.mutateAsync({ provider_id: providerId, link_type: linkType.trim(), value: parseFloat(value) });
    setLinkType("");
    setValue("");
    toast({ title: "Item LPU adicionado" });
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>LPU - {providerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Tipo de link" value={linkType} onChange={(e) => setLinkType(e.target.value)} className="flex-1" />
            <Input placeholder="Valor R$" type="number" value={value} onChange={(e) => setValue(e.target.value)} className="w-32" />
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de Link</TableHead>
                <TableHead>Valor (R$)</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.link_type}</TableCell>
                  <TableCell>R$ {item.value.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteItem.mutateAsync(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
