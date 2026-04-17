import * as XLSX from "xlsx";
import { LMContract, LM_FIELD_LABELS } from "@/hooks/useLMContracts";

// Ordem das colunas no export (sem senha, sem auxiliares internos)
const EXPORT_FIELDS: (keyof LMContract)[] = [
  "status",
  "pn",
  "nome_pn",
  "grupo",
  "recorrencia",
  "cont_guarda_chuva",
  "modelo_tr",
  "valor_mensal_tr",
  "observacao_contrato_lm",
  "item_sap",
  "protocolo_elleven",
  "nome_cliente",
  "etiqueta",
  "num_contrato_cliente",
  "endereco_instalacao",
  "data_assinatura",
  "vigencia_meses",
  "data_termino",
  "is_last_mile",
  "simples_nacional",
  "observacao_geral",
  "site_portal",
  "login",
  // senha: NUNCA exportada
];

function rowsToExport(rows: LMContract[]) {
  return rows.map((r) => {
    const out: Record<string, any> = {};
    EXPORT_FIELDS.forEach((f) => {
      const label = LM_FIELD_LABELS[f];
      const v: any = (r as any)[f];
      if (typeof v === "boolean") out[label] = v ? "Sim" : "Não";
      else out[label] = v ?? "";
    });
    return out;
  });
}

export function exportLMContractsXLSX(rows: LMContract[], fileName = "contratos_lm") {
  const data = rowsToExport(rows);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contratos LM");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function exportLMContractsCSV(rows: LMContract[], fileName = "contratos_lm") {
  const data = rowsToExport(rows);
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
