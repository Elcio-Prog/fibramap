import { useState, useEffect, useRef, useCallback } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { usePrecificacao, TABELAS, TabelaConfig } from "@/hooks/usePrecificacao";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Download, Upload, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
              {config.valueLabels.map((label, i) => (
                <TableHead key={i} className="min-w-[140px] font-semibold text-right">{label}</TableHead>
              ))}
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={config.valueFields.length + 2} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
            )}
            {rows.map((row, idx) => (
              <TableRow key={row.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                <TableCell className="font-medium text-sm">{row[config.keyField]}</TableCell>
                {config.valueFields.map(field => (
                  <TableCell key={field} className="p-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-8 text-right text-sm tabular-nums"
                      value={String(row[field] ?? 0).replace('.', ',')}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9,\-]/g, '');
                        handleValueChange(idx, field, raw.replace(',', '.'));
                      }}
                      onBlur={() => {
                        const num = Number(row[field]) || 0;
                        handleValueChange(idx, field, num.toFixed(2));
                      }}
                      onKeyDown={e => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          const current = Number(row[field]) || 0;
                          const step = 0.01;
                          const next = e.key === 'ArrowUp' ? current + step : current - step;
                          handleValueChange(idx, field, (Math.round(next * 100) / 100).toFixed(2));
                        }
                      }}
                    />
                  </TableCell>
                ))}
                <TableCell className="p-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(row.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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

export default function PrecificacaoPage() {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { exportarExcel, importarExcel, aplicarImport, loading } = usePrecificacao();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);

  if (authLoading || roleLoading) {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }
  if (!session || !isAdmin) return <Navigate to="/" replace />;

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) {
      toast({ title: "Formato inválido", description: "Apenas arquivos .xlsx são aceitos.", variant: "destructive" });
      return;
    }
    try {
      const changes = await importarExcel(file);
      if (changes.length === 0) {
        toast({ title: "Nenhuma alteração", description: "Os valores no arquivo são iguais aos atuais." });
      } else {
        setImportPreview(changes);
      }
    } catch (err: any) {
      toast({ title: "Erro ao ler arquivo", description: err.message, variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
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
            <Upload className="h-4 w-4 mr-1" /> Importar Excel
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      <Tabs defaultValue={TABELAS[0].tabela}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TABELAS.map(t => (
            <TabsTrigger key={t.tabela} value={t.tabela} className="text-xs sm:text-sm">{t.label}</TabsTrigger>
          ))}
        </TabsList>
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
    </div>
  );
}
