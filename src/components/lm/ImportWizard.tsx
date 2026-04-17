import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useImportProfiles, useCreateImportProfile } from "@/hooks/useImportProfiles";
import { useUpsertLMContracts, LM_FIELD_LABELS, type LMContract, type LMContractInput } from "@/hooks/useLMContracts";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Save, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { geocodeAddress } from "@/lib/geo-utils";

// Campos da tabela lm_contracts disponíveis para mapeamento.
// O label exibido é EXATAMENTE o nome usado nas colunas da tabela (LM_FIELD_LABELS).
type FieldKey = keyof LMContract;

const SYSTEM_FIELDS: { key: FieldKey; required?: boolean }[] = [
  { key: "status" },
  { key: "pn" },
  { key: "nome_pn" },
  { key: "grupo" },
  { key: "recorrencia" },
  { key: "cont_guarda_chuva" },
  { key: "modelo_tr" },
  { key: "valor_mensal_tr" },
  { key: "observacao_contrato_lm" },
  { key: "item_sap" },
  { key: "protocolo_elleven" },
  { key: "nome_cliente" },
  { key: "etiqueta" },
  { key: "num_contrato_cliente" },
  { key: "endereco_instalacao" },
  { key: "data_assinatura" },
  { key: "vigencia_meses" },
  { key: "data_termino" },
  { key: "is_last_mile" },
  { key: "simples_nacional" },
  { key: "observacao_geral" },
  { key: "site_portal" },
  { key: "login" },
  { key: "senha" },
  { key: "cidade" },
  { key: "uf" },
];

const NUMBER_FIELDS: FieldKey[] = ["valor_mensal_tr", "vigencia_meses"];
const BOOL_FIELDS: FieldKey[] = ["is_last_mile", "simples_nacional"];
const DATE_FIELDS: FieldKey[] = ["data_assinatura", "data_termino"];

type Step = "upload" | "sheet" | "mapping" | "summary";

function parseCidadeUF(endereco: string): { cidade?: string; uf?: string } {
  if (!endereco) return {};
  const ufMatch = endereco.match(/[-–,/\s]\s*([A-Z]{2})\s*(?:[,\s-–]|$)/);
  const uf = ufMatch ? ufMatch[1] : undefined;
  if (uf) {
    const beforeUF = endereco.substring(0, endereco.lastIndexOf(uf)).replace(/[-–,/\s]+$/, "");
    const parts = beforeUF.split(/[,\-–]+/).map(s => s.trim()).filter(Boolean);
    const cidade = parts.length > 0 ? parts[parts.length - 1].replace(/^\d{5}-?\d{3}\s*/, "").trim() : undefined;
    return { cidade: cidade || undefined, uf };
  }
  return {};
}

function parseBool(v: any): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (["", "nao", "não", "false", "0", "no", "n", "f"].includes(s)) return false;
  // Qualquer outro valor não-vazio (sim, true, 1, x, simples, etc.) = true
  return true;
}

function parseDate(v: any): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  // Excel serial date
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const [, d, m, y] = br;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return s;
}

interface ImportSummary {
  total: number;
  newRecords: number;
  updated: number;
  ignored: number;
  errors: string[];
}

export default function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [rows, setRows] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [profileName, setProfileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profiles } = useImportProfiles();
  const createProfile = useCreateImportProfile();
  const upsertContracts = useUpsertLMContracts();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      if (wb.SheetNames.length === 1) {
        loadSheet(wb, wb.SheetNames[0]);
        autoMap(wb, wb.SheetNames[0]);
        setStep("mapping");
      } else {
        setStep("sheet");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadSheet = (wb: XLSX.WorkBook, name: string) => {
    setSelectedSheet(name);
    const sheet = wb.Sheets[name];
    const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (json.length < 2) {
      toast({ title: "Planilha vazia ou sem dados", variant: "destructive" });
      return;
    }
    const h = json[0].map((c: any) => String(c).trim());
    setHeaders(h);
    setRows(json.slice(1));
  };

  /** Auto-mapeia colunas da planilha cujo nome bate (case/acento-insensível) com o label da tabela. */
  const autoMap = (wb: XLSX.WorkBook, name: string) => {
    const sheet = wb.Sheets[name];
    const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const h = (json[0] || []).map((c: any) => String(c).trim());
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const headerByNorm: Record<string, string> = {};
    h.forEach((col) => { headerByNorm[norm(col)] = col; });
    const auto: Record<string, string> = {};
    SYSTEM_FIELDS.forEach((f) => {
      const candidates = [LM_FIELD_LABELS[f.key], f.key];
      for (const c of candidates) {
        const match = headerByNorm[norm(c)];
        if (match) { auto[f.key] = match; break; }
      }
    });
    setMapping(auto);
  };

  const applyProfile = (profileId: string) => {
    const p = profiles?.find((pr) => pr.id === profileId);
    if (p) setMapping(p.column_mapping);
  };

  const saveProfile = async () => {
    if (!profileName.trim()) return;
    await createProfile.mutateAsync({
      name: profileName.trim(),
      column_mapping: mapping,
      key_field: "numero",
      user_id: user?.id,
    });
    toast({ title: "Perfil salvo!" });
    setProfileName("");
  };

  const processImport = async () => {
    setImporting(true);
    const errors: string[] = [];
    const items: LMContractInput[] = [];
    let ignored = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;

      const getValue = (field: string) => {
        const col = mapping[field];
        if (!col) return undefined;
        const idx = headers.indexOf(col);
        if (idx === -1) return undefined;
        const v = row[idx];
        return v === "" || v === null || v === undefined ? undefined : v;
      };

      const pn = getValue("pn");
      const endereco = getValue("endereco_instalacao");
      const valorStr = getValue("valor_mensal_tr");

      // Skip apenas linhas 100% vazias (todos os campos mapeados)
      const allEmpty = SYSTEM_FIELDS.every((f) => getValue(f.key) === undefined);
      if (allEmpty) { ignored++; continue; }

      let valor: number | null = null;
      if (valorStr !== undefined) {
        const n = parseFloat(String(valorStr).replace(",", "."));
        if (!isNaN(n)) valor = n;
      }

      // Auto-extrair cidade/UF se não mapeados
      let cidadeVal = getValue("cidade");
      let ufVal = getValue("uf");
      if ((!cidadeVal || !ufVal) && endereco) {
        const parsed = parseCidadeUF(String(endereco));
        if (!cidadeVal && parsed.cidade) cidadeVal = parsed.cidade;
        if (!ufVal && parsed.uf) ufVal = parsed.uf;
      }

      const item: LMContractInput = {
        user_id: user?.id ?? null,
        geocoding_status: endereco ? "pending" : "skipped",
        ...(endereco ? { endereco_instalacao: String(endereco) } : {}),
        ...(valor !== null ? { valor_mensal_tr: valor } : {}),
        ...(pn ? { pn: String(pn) } : {}),
        ...(cidadeVal ? { cidade: String(cidadeVal) } : {}),
        ...(ufVal ? { uf: String(ufVal) } : {}),
      };

      // Demais campos
      for (const f of SYSTEM_FIELDS) {
        if (["pn", "endereco_instalacao", "valor_mensal_tr", "cidade", "uf"].includes(f.key)) continue;
        const v = getValue(f.key);
        if (v === undefined) continue;
        if (NUMBER_FIELDS.includes(f.key)) {
          const n = parseFloat(String(v).replace(",", "."));
          if (!isNaN(n)) (item as any)[f.key] = n;
        } else if (BOOL_FIELDS.includes(f.key)) {
          const b = parseBool(v);
          if (b !== undefined) (item as any)[f.key] = b;
        } else if (DATE_FIELDS.includes(f.key)) {
          const d = parseDate(v);
          if (d) (item as any)[f.key] = d;
        } else {
          (item as any)[f.key] = String(v);
        }
      }

      items.push(item);
    }

    // Cada linha vira um novo registro; o nº sequencial é gerado pelo banco.
    const unique = items;

    setSummary({
      total: rows.length,
      newRecords: unique.length,
      updated: 0,
      ignored,
      errors,
    });

    if (unique.length > 0) {
      try {
        await upsertContracts.mutateAsync(unique);
        toast({ title: `${unique.length} registros importados com sucesso!` });
        const itemsToGeocode = unique.filter(
          (i) => i.endereco_instalacao && i.geocoding_status === "pending"
        );
        geocodeInBackground(itemsToGeocode);
      } catch (err: any) {
        toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
      }
    }

    setImporting(false);
    setStep("summary");
  };

  const geocodeInBackground = async (items: LMContractInput[]) => {
    const { supabase } = await import("@/integrations/supabase/client");
    for (const item of items) {
      if (!item.endereco_instalacao) continue;
      try {
        const result = await geocodeAddress(item.endereco_instalacao);
        if (result) {
          await supabase
            .from("lm_contracts")
            .update({ lat: result.lat, lng: result.lng, geocoding_status: "done" } as any)
            .eq("endereco_instalacao", item.endereco_instalacao);
        } else {
          await supabase
            .from("lm_contracts")
            .update({ geocoding_status: "failed" } as any)
            .eq("endereco_instalacao", item.endereco_instalacao);
        }
        await new Promise((r) => setTimeout(r, 1100));
      } catch {
        // continue
      }
    }
  };

  const reset = () => {
    setStep("upload");
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");
    setRows([]);
    setHeaders([]);
    setMapping({});
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Importação em Massa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload */}
        {step === "upload" && (
          <div className="space-y-3">
            {profiles && profiles.length > 0 && (
              <div>
                <label className="text-sm text-muted-foreground">Perfil salvo</label>
                <Select onValueChange={applyProfile}>
                  <SelectTrigger><SelectValue placeholder="Selecione um perfil (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
            <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Selecionar arquivo XLSX/CSV
            </Button>
          </div>
        )}

        {/* Sheet selection */}
        {step === "sheet" && workbook && (
          <div className="space-y-3">
            <label className="text-sm font-medium">Selecione a aba:</label>
            {sheetNames.map((name) => (
              <Button
                key={name}
                variant={selectedSheet === name ? "default" : "outline"}
                className="mr-2 mb-2"
                onClick={() => {
                  loadSheet(workbook, name);
                  autoMap(workbook, name);
                  setStep("mapping");
                }}
              >
                {name}
              </Button>
            ))}
          </div>
        )}

        {/* Mapping */}
        {step === "mapping" && headers.length > 0 && (
          <div className="space-y-4">
            {/* Preview */}
            <div className="overflow-x-auto max-h-48 border rounded-md">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-muted">
                    {headers.map((h, i) => (
                      <th key={i} className="px-2 py-1 text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-t">
                      {headers.map((_, ci) => (
                        <td key={ci} className="px-2 py-1 whitespace-nowrap max-w-[150px] truncate">
                          {String(row[ci] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Os nomes ao lado correspondem exatamente às colunas da tabela. Colunas com nome igual foram mapeadas automaticamente.
            </p>

            {/* Column mapping */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Mapeamento de colunas:</label>
              {SYSTEM_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <span className="text-sm w-56 shrink-0">
                    {LM_FIELD_LABELS[field.key]}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </span>
                  <Select
                    value={mapping[field.key] || "__ignore__"}
                    onValueChange={(v) =>
                      setMapping((prev) => ({ ...prev, [field.key]: v === "__ignore__" ? "" : v }))
                    }
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Ignorar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore__">Ignorar / Não existe</SelectItem>
                      {headers.filter((h) => h !== "").map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Save profile */}
            <div className="flex gap-2">
              <Input
                placeholder="Nome do perfil (opcional)"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="text-sm"
              />
              <Button size="sm" variant="outline" onClick={saveProfile} disabled={!profileName.trim()}>
                <Save className="h-4 w-4 mr-1" /> Salvar
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={processImport} disabled={importing}>
                {importing ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
                {importing ? "Importando..." : `Importar ${rows.length} linhas`}
              </Button>
            </div>
          </div>
        )}

        {/* Summary */}
        {step === "summary" && summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Total de linhas:</span>
                <span className="font-medium">{summary.total}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Importados: {summary.newRecords}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>Ignorados: {summary.ignored}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>Erros: {summary.errors.length}</span>
              </div>
            </div>
            {summary.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded border p-2 text-xs text-destructive">
                {summary.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <Button onClick={reset} variant="outline" className="w-full">Nova importação</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
