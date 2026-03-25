import { useState, useEffect, useRef, useCallback } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { usePrecificacao, TABELAS, TabelaConfig } from "@/hooks/usePrecificacao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Download, Upload, Save, Plus, Trash2, Settings, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { groupByCategory, type EquipmentCategory } from "@/lib/equipment-categories";

const CUSTO_POR_MEGA_ORDER = [
  "Custo do Metro de rede",
  "Custo do Metro Dark Fiber",
  "Custo do Mega rede Normal",
  "Custo do Mega uso de BGP",
  "NT L2L",
  "NT Transporte PTT",
  "Piracicaba",
  "Araras",
  "Santos",
  "Cubatão",
  "Sorocaba",
  "Cesario Lange",
  "Bragança Paulista",
  "Cordeiropolis",
  "Indaiatuba",
  "Itapira",
  "Rio Claro",
  "Mogi Guaçu",
  "Circuito Existente",
  "Custo Operacional por metro de Fibra Dark FIber",
  "Rede Normal",
];

function sortByCustomOrder(rows: any[], keyField: string, order: string[]) {
  return [...rows].sort((a, b) => {
    const idxA = order.indexOf(a[keyField]);
    const idxB = order.indexOf(b[keyField]);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

function TabelaTab({ config }: { config: TabelaConfig }) {
  const { fetchTabela, upsertTabela, addRow, deleteRow, loading } = usePrecificacao();
  const [rows, setRows] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      let data = await fetchTabela(config);
      if (config.tabela === "custo_por_mega") {
        data = sortByCustomOrder(data, config.keyField, CUSTO_POR_MEGA_ORDER);
      }
      setRows(data);
    } catch { }
    setFetching(false);
  }, [config, fetchTabela]);

  useEffect(() => { load(); }, [load]);

  const handleValueChange = (rowIdx: number, field: string, value: string) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    const cleaned = rows.map(r => {
      const { created_at, updated_at, ...rest } = r;
      return rest;
    });
    try {
      await upsertTabela(config, cleaned);
      await load();
    } catch { }
  };

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    try {
      await addRow(config, newKey.trim());
      setNewKey("");
      setShowAddDialog(false);
      await load();
    } catch { }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRow(config, id);
      await load();
    } catch { }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[280px] font-semibold">{config.keyField}</TableHead>
              {(config.textLabels ?? []).map((label, i) => (
                <TableHead key={`t-${i}`} className="min-w-[200px] font-semibold">{label}</TableHead>
              ))}
              {config.valueLabels.map((label, i) => (
                <TableHead key={i} className="min-w-[140px] font-semibold text-right">{label}</TableHead>
              ))}
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={(config.textFields?.length ?? 0) + config.valueFields.length + 2} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
            )}
            {isEquipamentos ? (
              groupByCategory(rows as { equipamento: string }[]).map(({ category, items }) => (
                <>
                  <TableRow key={`cat-${category}`}>
                    <TableCell
                      colSpan={(config.textFields?.length ?? 0) + config.valueFields.length + 2}
                      className="bg-primary/10 font-bold text-sm text-primary py-2 px-4"
                    >
                      {category}
                    </TableCell>
                  </TableRow>
                  {items.map((row: any) => {
                    const idx = rows.indexOf(row);
                    return renderRow(row, idx);
                  })}
                </>
              ))
            ) : (
              rows.map((row, idx) => renderRow(row, idx))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar registro</DialogTitle>
            <DialogDescription>Digite o identificador do novo registro para "{config.label}".</DialogDescription>
          </DialogHeader>
          <Input placeholder={config.keyField} value={newKey} onChange={e => setNewKey(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!newKey.trim() || loading}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SetupTab() {
  const [fatorAjuste, setFatorAjuste] = useState(100);
  const [regraProjetista, setRegraProjetista] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projetistaOptions, setProjetistaOptions] = useState<string[]>([]);
  const [newProjetista, setNewProjetista] = useState("");

  useEffect(() => {
    (async () => {
      const [setupRes, projRes] = await Promise.all([
        supabase.from("configuracoes" as any).select("valor").eq("chave", "setup_precificacao").maybeSingle(),
        supabase.from("configuracoes" as any).select("valor").eq("chave", "projetistas").maybeSingle(),
      ]);
      if (setupRes.data) {
        const val = (setupRes.data as any).valor;
        setFatorAjuste(val?.fator_ajuste ?? 100);
        setRegraProjetista(val?.regra_projetista_ativa ?? false);
      }
      if (projRes.data) {
        const val = (projRes.data as any).valor;
        if (Array.isArray(val)) setProjetistaOptions(val);
      }
      setLoading(false);
    })();
  }, []);

  const addProjetista = async () => {
    const name = newProjetista.trim();
    if (!name || projetistaOptions.includes(name)) return;
    const updated = [...projetistaOptions, name].sort();
    const { error } = await supabase.from("configuracoes" as any).upsert({ chave: "projetistas", valor: updated } as any, { onConflict: "chave" });
    if (!error) { setProjetistaOptions(updated); setNewProjetista(""); }
  };

  const removeProjetista = async (name: string) => {
    const updated = projetistaOptions.filter(p => p !== name);
    await supabase.from("configuracoes" as any).upsert({ chave: "projetistas", valor: updated } as any, { onConflict: "chave" });
    setProjetistaOptions(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("configuracoes" as any)
        .update({
          valor: { fator_ajuste: fatorAjuste, regra_projetista_ativa: regraProjetista },
          updated_at: new Date().toISOString(),
        } as any)
        .eq("chave", "setup_precificacao");
      if (error) throw error;
      toast({ title: "Setup salvo com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold mb-1">Configurações de Cálculo</h3>
          <p className="text-xs text-muted-foreground">Ajustes aplicados ao valor mínimo calculado pela engine de precificação.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fator-ajuste" className="text-sm font-medium">
            Fator de ajuste de erro (%)
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="fator-ajuste"
              type="number"
              min={0}
              step={1}
              className="w-32"
              value={fatorAjuste}
              onChange={e => {
                const v = Math.max(0, Number(e.target.value) || 0);
                setFatorAjuste(v);
              }}
            />
            <span className="text-xs text-muted-foreground">
              {fatorAjuste === 100
                ? "Sem ajuste"
                : fatorAjuste > 100
                ? `+${fatorAjuste - 100}% de incremento`
                : `${fatorAjuste - 100}% de decremento`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            100% = valor original. 110% = +10% sobre o mínimo. 90% = -10% sobre o mínimo.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-md border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="regra-projetista" className="text-sm font-medium">Regra do Projetista</Label>
            <p className="text-xs text-muted-foreground">
              Quando ativa, exige validação para links com banda &gt; 500 MB, distância &gt; 2000m ou tecnologia PTP.
            </p>
          </div>
          <Switch
            id="regra-projetista"
            checked={regraProjetista}
            onCheckedChange={setRegraProjetista}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-1" /> Salvar Setup
        </Button>
      </div>

      {/* Gerenciar Projetistas */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold mb-1">Gerenciar Projetistas</h3>
          <p className="text-xs text-muted-foreground">Adicione ou remova opções de projetistas disponíveis no formulário de pré viabilidade.</p>
        </div>
        <div className="flex gap-2">
          <Input className="h-9" placeholder="Nome do projetista" value={newProjetista}
            onChange={e => setNewProjetista(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addProjetista())} />
          <Button type="button" size="sm" className="gap-1 h-9" onClick={addProjetista}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {projetistaOptions.map(p => (
            <Badge key={p} variant="secondary" className="gap-1 text-xs">
              {p}
              <button type="button" onClick={() => removeProjetista(p)} className="ml-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {projetistaOptions.length === 0 && <span className="text-xs text-muted-foreground">Nenhum projetista cadastrado</span>}
        </div>
      </div>
    </div>
  );
}

export default function PrecificacaoPage() {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { exportarExcel, importarArquivo, aplicarImport, loading } = usePrecificacao();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvTabela, setCsvTabela] = useState("");

  if (authLoading || roleLoading) {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!session || !isAdmin) return <Navigate to="/" replace />;

  const processImport = async (file: File, tabelaFilter?: string) => {
    try {
      const changes = await importarArquivo(file, tabelaFilter);
      if (changes.length === 0) {
        toast({ title: "Nenhuma alteração", description: "Os valores no arquivo são iguais aos atuais." });
      } else {
        setImportPreview(changes);
      }
    } catch (err: any) {
      toast({ title: "Erro ao ler arquivo", description: err.message, variant: "destructive" });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".csv")) {
      toast({ title: "Formato inválido", description: "Apenas arquivos .xlsx ou .csv são aceitos.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (ext.endsWith(".csv")) {
      setCsvFile(file);
      setCsvTabela("");
    } else {
      await processImport(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCsvConfirm = async () => {
    if (!csvFile || !csvTabela) return;
    await processImport(csvFile, csvTabela);
    setCsvFile(null);
    setCsvTabela("");
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    try {
      await aplicarImport(importPreview);
      setImportPreview(null);
      // Force reload by navigating to same page
      window.location.reload();
    } catch { }
  };

  const totalChanges = importPreview?.reduce((sum, t) => sum + t.changes.length, 0) ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dados de Precificação</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie as tabelas de referência para cálculos de precificação</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportarExcel} disabled={loading}>
            <Download className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            <Upload className="h-4 w-4 mr-1" /> Importar
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      <Tabs defaultValue="setup">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="setup" className="text-xs sm:text-sm">
            <Settings className="h-3.5 w-3.5 mr-1" /> Setup
          </TabsTrigger>
          {TABELAS.map(t => (
            <TabsTrigger key={t.tabela} value={t.tabela} className="text-xs sm:text-sm">{t.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="setup">
          <SetupTab />
        </TabsContent>
        {TABELAS.map(t => (
          <TabsContent key={t.tabela} value={t.tabela}>
            <TabelaTab config={t} />
          </TabsContent>
        ))}
      </Tabs>

      {/* Import preview dialog */}
      <Dialog open={!!importPreview} onOpenChange={() => setImportPreview(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Confirmar Importação</DialogTitle>
            <DialogDescription>{totalChanges} valor(es) serão atualizados. Confirmar?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {importPreview?.map(({ label, changes }) => (
              <div key={label}>
                <p className="font-semibold text-sm mb-1">{label}</p>
                <div className="rounded border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Identificador</TableHead>
                        <TableHead className="text-xs">Campo</TableHead>
                        <TableHead className="text-xs text-right">Atual</TableHead>
                        <TableHead className="text-xs text-right">Novo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {changes.map((ch: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs py-1">{ch.key}</TableCell>
                          <TableCell className="text-xs py-1">{ch.field}</TableCell>
                          <TableCell className="text-xs py-1 text-right tabular-nums">{ch.oldVal.toFixed(6)}</TableCell>
                          <TableCell className="text-xs py-1 text-right tabular-nums font-semibold text-primary">{ch.newVal.toFixed(6)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreview(null)}>Cancelar</Button>
            <Button onClick={handleConfirmImport} disabled={loading}>Confirmar Importação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV table selector dialog */}
      <Dialog open={!!csvFile} onOpenChange={() => { setCsvFile(null); setCsvTabela(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar tabela</DialogTitle>
            <DialogDescription>Escolha para qual tabela os dados do CSV serão importados.</DialogDescription>
          </DialogHeader>
          <Select value={csvTabela} onValueChange={setCsvTabela}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a tabela..." />
            </SelectTrigger>
            <SelectContent>
              {TABELAS.map(t => (
                <SelectItem key={t.tabela} value={t.tabela}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCsvFile(null); setCsvTabela(""); }}>Cancelar</Button>
            <Button onClick={handleCsvConfirm} disabled={!csvTabela || loading}>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
