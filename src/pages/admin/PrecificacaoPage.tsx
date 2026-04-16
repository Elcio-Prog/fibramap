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
import { Download, Upload, Save, Plus, Trash2, Settings, X, Pencil, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { classifyEquipment, groupByCategory, CATEGORY_ORDER, type EquipmentCategory } from "@/lib/equipment-categories";

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
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [usdRate, setUsdRate] = useState<number | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

  const isEquipamentos = config.tabela === "equipamentos_valor";

  useEffect(() => {
    if (isEquipamentos) {
      fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL")
        .then(res => res.json())
        .then(data => {
          if (data?.USDBRL?.bid) {
            setUsdRate(Number(data.USDBRL.bid));
          }
        })
        .catch(err => console.error("Error fetching USD rate:", err));
    }
  }, [isEquipamentos]);

  // Derive existing categories from current rows for equipamentos
  const existingCategories = isEquipamentos
    ? Array.from(new Set(
        groupByCategory(rows as { equipamento: string }[]).map(g => g.category)
      ))
    : [];

  const load = useCallback(async () => {
    setFetching(true);
    try {
      let data = await fetchTabela(config);
      if (config.tabela === "custo_por_mega") {
        data = sortByCustomOrder(data, config.keyField, CUSTO_POR_MEGA_ORDER);
      }
      
      // Auto-calculate for equipamentos if we have USD rate
      if (isEquipamentos && usdRate) {
        data = data.map(r => {
          const cat = classifyEquipment(r.equipamento);
          const needsAutoCalc = ["Firewall", "Firewall Licença", "Switch"].includes(cat);
          const hasDollar = Number(r.valor_dolar) > 0;

          if (needsAutoCalc && hasDollar) {
            const cambioComTaxa = usdRate + 0.25;
            const valor = Number(r.valor_dolar) * cambioComTaxa;
            const imposto = Number(r.imposto) || 0;
            const valorFinal = valor * (1 + (imposto / 100));
            return {
              ...r,
              valor: valor.toFixed(2),
              valor_final: valorFinal.toFixed(2)
            };
          }
          return r;
        });
      }

      setRows(data);
    } catch { }
    setFetching(false);
  }, [config, fetchTabela, isEquipamentos, usdRate]);

  useEffect(() => { load(); }, [load]);

  const handleValueChange = (rowIdx: number, field: string, value: string) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      const nextRow = { ...r, [field]: value };

      // Automated calculations for specific categories
      if (isEquipamentos) {
        const cat = classifyEquipment(nextRow.equipamento);
        const isTargetCat = ["Firewall", "Firewall Licença", "Switch"].includes(cat);
        
        if (isTargetCat) {
          if (field === "valor_dolar" && usdRate && Number(value) > 0) {
            const cambioComTaxa = usdRate + 0.25;
            const valor = Number(value) * cambioComTaxa;
            nextRow.valor = valor.toFixed(2);
            nextRow.valor_final = (valor * (1 + (Number(nextRow.imposto) || 0) / 100)).toFixed(2);
          } else if (field === "imposto") {
            const valor = Number(nextRow.valor) || 0;
            nextRow.valor_final = (valor * (1 + (Number(value) || 0) / 100)).toFixed(2);
          } else if (field === "valor") {
            const valor = Number(value) || 0;
            nextRow.valor_final = (valor * (1 + (Number(nextRow.imposto) || 0) / 100)).toFixed(2);
          }
        }
      }

      return nextRow;
    }));
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
      let keyWithPrefix = newKey.trim();
      
      // Auto-prefix for equipment based on selected category to ensure correct classification
      if (isEquipamentos && selectedCategory && selectedCategory !== "Outros") {
        const prefix = selectedCategory === "Firewall Licença" ? "Licença - " : `${selectedCategory} - `;
        // Only prepend if not already present in some form
        if (!keyWithPrefix.toUpperCase().includes(selectedCategory.toUpperCase()) && 
            !keyWithPrefix.toUpperCase().includes("ANUAL") &&
            !keyWithPrefix.toUpperCase().includes("LICEN")) {
          keyWithPrefix = `${prefix}${keyWithPrefix}`;
        }
      }
      
      await addRow(config, keyWithPrefix);
      setNewKey("");
      setSelectedCategory("");
      setCustomCategory("");
      setShowCustomCategory(false);
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

  const handleStartEditName = (row: any) => {
    setEditingNameId(row.id);
    setEditingNameValue(row[config.keyField]);
  };

  const handleCancelEditName = () => {
    setEditingNameId(null);
    setEditingNameValue("");
  };

  const handleSaveEditName = async (id: string) => {
    const trimmed = editingNameValue.trim();
    if (!trimmed) return;
    try {
      const { error } = await supabase
        .from(config.tabela as any)
        .update({ [config.keyField]: trimmed } as any)
        .eq("id", id);
      if (error) throw error;
      setRows(prev => prev.map(r => r.id === id ? { ...r, [config.keyField]: trimmed } : r));
      toast({ title: "Nome atualizado" });
    } catch (err: any) {
      toast({ title: "Erro ao renomear", description: err.message, variant: "destructive" });
    } finally {
      setEditingNameId(null);
      setEditingNameValue("");
    }
  };

  const handleOpenAddDialog = () => {
    setNewKey("");
    setSelectedCategory("");
    setCustomCategory("");
    setShowCustomCategory(false);
    setShowAddDialog(true);
  };

  const handleCategoryChange = (value: string) => {
    if (value === "__custom__") {
      setShowCustomCategory(true);
      setSelectedCategory("");
    } else {
      setShowCustomCategory(false);
      setCustomCategory("");
      setSelectedCategory(value);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const renderRow = (row: any, idx: number) => (
    <TableRow key={row.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
      <TableCell className="font-medium text-sm">
        {isEquipamentos && editingNameId === row.id ? (
          <div className="flex items-center gap-1">
            <Input
              type="text"
              autoFocus
              className="h-7 text-sm flex-1"
              value={editingNameValue}
              onChange={e => setEditingNameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleSaveEditName(row.id);
                if (e.key === "Escape") handleCancelEditName();
              }}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={() => handleSaveEditName(row.id)}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleCancelEditName}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group">
            <span>{row[config.keyField]}</span>
            {isEquipamentos && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                onClick={() => handleStartEditName(row)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </TableCell>
      {(config.textFields ?? []).map(field => (
        <TableCell key={field} className="p-1">
          <Input
            type="text"
            className="h-8 text-sm"
            value={row[field] ?? ""}
            onChange={e => handleValueChange(idx, field, e.target.value)}
          />
        </TableCell>
      ))}
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
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-2">
          {isEquipamentos && usdRate && (
            <Badge variant="secondary" className="gap-1.5 py-1 px-3">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Câmbio USD: <span className="font-bold ml-1">R$ {usdRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-muted-foreground mx-1">+ $0,25</span>
              <span className="font-bold">= R$ {(usdRate + 0.25).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleOpenAddDialog}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </div>
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
                <TableHead key={i} className="min-w-[140px] font-semibold text-right align-top pt-3 pb-2">
                  <div className="flex flex-col items-end justify-start h-full">
                    <span>{label}</span>
                    {(label.includes("Dolar") || label.includes("Dólar")) && isEquipamentos && (
                      <span className="text-[10px] font-normal text-muted-foreground mt-0.5 leading-tight">+ $0,25 incluso no cálculo</span>
                    )}
                  </div>
                </TableHead>
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
            <DialogTitle>Adicionar {isEquipamentos ? "equipamento" : "registro"}</DialogTitle>
            <DialogDescription>
              {isEquipamentos
                ? "Selecione a categoria e digite o nome do novo equipamento."
                : `Digite o identificador do novo registro para "${config.label}".`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {isEquipamentos && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Categoria</Label>
                <Select
                  value={showCustomCategory ? "__custom__" : selectedCategory}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_ORDER.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">+ Nova categoria...</SelectItem>
                  </SelectContent>
                </Select>
                {showCustomCategory && (
                  <Input
                    placeholder="Nome da nova categoria"
                    value={customCategory}
                    onChange={e => setCustomCategory(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
            )}
            <div className="space-y-2">
              {isEquipamentos && <Label className="text-sm font-medium">Nome do equipamento</Label>}
              <Input
                placeholder={isEquipamentos ? "Ex: FN-FG-40F" : config.keyField}
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleAdd}
              disabled={!newKey.trim() || loading || (isEquipamentos && !selectedCategory && (!showCustomCategory || !customCategory.trim()))}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

      <Tabs defaultValue={TABELAS[0]?.tabela}>
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
