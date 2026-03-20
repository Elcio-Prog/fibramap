import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

export interface TabelaConfig {
  tabela: string;
  label: string;
  keyField: string;
  valueFields: string[];
  valueLabels: string[];
}

export const TABELAS: TabelaConfig[] = [
  {
    tabela: "custo_por_mega",
    label: "Custo por Mega",
    keyField: "identificacao",
    valueFields: ["valor_link", "valor_link_full", "valor_link_flex", "valor_link_empresa", "valor_l2l", "valor_ptt"],
    valueLabels: ["Valor Link", "Valor Link Full", "Valor Link Flex", "Valor Link Empresa", "Valor L2L", "Valor PTT"],
  },
  {
    tabela: "taxas_link",
    label: "Taxas Link",
    keyField: "identificacao",
    valueFields: ["margem_lucro"],
    valueLabels: ["Margem de Lucro"],
  },
  {
    tabela: "valor_bloco_ip",
    label: "Bloco IP",
    keyField: "identificacao",
    valueFields: ["valor"],
    valueLabels: ["Valor"],
  },
  {
    tabela: "equipamentos_valor",
    label: "Equipamentos",
    keyField: "equipamento",
    valueFields: ["valor_final"],
    valueLabels: ["Valor Final"],
  },
  {
    tabela: "tabela_custos_pabx",
    label: "Custos PABX",
    keyField: "identificador",
    valueFields: ["preco_final"],
    valueLabels: ["Preço Final"],
  },
  {
    tabela: "custo_voz_geral",
    label: "Voz Geral",
    keyField: "descricao",
    valueFields: ["custo_minuto"],
    valueLabels: ["Custo/Minuto"],
  },
  {
    tabela: "custos_voz_pais",
    label: "Voz Internacional",
    keyField: "pais",
    valueFields: ["custo_final"],
    valueLabels: ["Custo Final"],
  },
];

export function usePrecificacao() {
  const [loading, setLoading] = useState(false);

  const fetchTabela = useCallback(async (config: TabelaConfig) => {
    const { data, error } = await supabase
      .from(config.tabela as any)
      .select("*")
      .order(config.keyField);
    if (error) throw error;
    return data as any[];
  }, []);

  const upsertTabela = useCallback(async (config: TabelaConfig, rows: any[]) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from(config.tabela as any)
        .upsert(rows as any, { onConflict: config.keyField });
      if (error) throw error;
      toast({ title: "Salvo com sucesso", description: `Tabela "${config.label}" atualizada.` });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addRow = useCallback(async (config: TabelaConfig, keyValue: string) => {
    setLoading(true);
    try {
      const row: any = { [config.keyField]: keyValue };
      config.valueFields.forEach(f => row[f] = 0);
      const { error } = await supabase.from(config.tabela as any).insert(row as any);
      if (error) throw error;
      toast({ title: "Registro adicionado" });
    } catch (err: any) {
      toast({ title: "Erro ao adicionar", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRow = useCallback(async (config: TabelaConfig, id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from(config.tabela as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Registro removido" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const exportarExcel = useCallback(async () => {
    setLoading(true);
    try {
      const wb = XLSX.utils.book_new();
      for (const config of TABELAS) {
        const rows = await fetchTabela(config);
        const headers = [config.keyField, ...config.valueFields];
        const headerLabels = [config.keyField, ...config.valueLabels];
        const sheetData = [headerLabels, ...rows.map((r: any) => headers.map(h => r[h] ?? 0))];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // Column widths
        ws["!cols"] = headers.map((_, i) => ({ wch: i === 0 ? 45 : 18 }));

        // Style header row
        for (let c = 0; c < headers.length; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
          if (cell) {
            cell.s = {
              fill: { fgColor: { rgb: "2E75B6" } },
              font: { bold: true, color: { rgb: "FFFFFF" } },
              alignment: { horizontal: "center" },
            };
          }
        }

        // Style data rows
        for (let r = 1; r < sheetData.length; r++) {
          for (let c = 0; c < headers.length; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            if (!cell) continue;
            const isEven = r % 2 === 0;
            cell.s = {
              fill: c === 0
                ? { fgColor: { rgb: "FFF9E6" } }
                : isEven ? { fgColor: { rgb: "F2F2F2" } } : {},
              numFmt: c > 0 ? "#,##0.000000" : undefined,
            };
            if (c > 0) cell.t = "n";
          }
        }

        XLSX.utils.book_append_sheet(wb, ws, config.label.substring(0, 31));
      }
      XLSX.writeFile(wb, "dados_precificacao.xlsx");
      toast({ title: "Excel exportado com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro na exportação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [fetchTabela]);

  const importarArquivo = useCallback(async (file: File): Promise<{ tabela: string; label: string; changes: { key: string; field: string; oldVal: number; newVal: number }[] }[]> => {
    const buffer = await file.arrayBuffer();
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const wb = XLSX.read(buffer, { type: "array", ...(isCsv ? { raw: true } : {}) });
    const allChanges: { tabela: string; label: string; changes: { key: string; field: string; oldVal: number; newVal: number }[] }[] = [];

    const processSheet = async (rows: any[][], config: TabelaConfig) => {
      if (rows.length < 2) return;
      const currentData = await fetchTabela(config);
      const currentMap = new Map(currentData.map((r: any) => [r[config.keyField], r]));
      const changes: { key: string; field: string; oldVal: number; newVal: number }[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const key = String(row[0] ?? "").trim();
        if (!key || !currentMap.has(key)) continue;
        const current = currentMap.get(key);
        for (let j = 0; j < config.valueFields.length; j++) {
          const rawVal = String(row[j + 1] ?? "0").replace(",", ".");
          const newVal = Number(rawVal) || 0;
          const oldVal = Number(current[config.valueFields[j]]) || 0;
          if (Math.abs(newVal - oldVal) > 0.0000001) {
            changes.push({ key, field: config.valueFields[j], oldVal, newVal });
          }
        }
      }
      if (changes.length > 0) {
        allChanges.push({ tabela: config.tabela, label: config.label, changes });
      }
    };

    if (isCsv) {
      // CSV: single sheet — try to match by first header or iterate all configs
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      for (const config of TABELAS) {
        await processSheet(rows, config);
      }
    } else {
      for (const config of TABELAS) {
        const sheetName = wb.SheetNames.find(s => s === config.label.substring(0, 31));
        if (!sheetName) continue;
        const ws = wb.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        await processSheet(rows, config);
      }
    }
    return allChanges;
  }, [fetchTabela]);

  const aplicarImport = useCallback(async (allChanges: { tabela: string; label: string; changes: { key: string; field: string; oldVal: number; newVal: number }[] }[]) => {
    setLoading(true);
    try {
      for (const { tabela, changes } of allChanges) {
        const config = TABELAS.find(t => t.tabela === tabela)!;
        const currentData = await fetchTabela(config);
        const currentMap = new Map(currentData.map((r: any) => [r[config.keyField], { ...r }]));

        for (const ch of changes) {
          const row = currentMap.get(ch.key);
          if (row) row[ch.field] = ch.newVal;
        }

        const rowsToUpdate = [...new Set(changes.map(c => c.key))].map(k => currentMap.get(k)!);
        // Remove created_at/updated_at to let DB handle
        const cleaned = rowsToUpdate.map(r => {
          const { created_at, updated_at, ...rest } = r;
          return rest;
        });
        await supabase.from(tabela as any).upsert(cleaned as any, { onConflict: config.keyField });
      }
      toast({ title: "Importação concluída", description: "Todos os valores foram atualizados." });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTabela]);

  return { loading, fetchTabela, upsertTabela, addRow, deleteRow, exportarExcel, importarArquivo, aplicarImport };
}
