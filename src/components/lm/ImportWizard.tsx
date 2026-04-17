import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useImportProfiles, useCreateImportProfile } from "@/hooks/useImportProfiles";
import { useUpsertComprasLM } from "@/hooks/useComprasLM";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Save, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { geocodeAddress } from "@/lib/geo-utils";

const SYSTEM_FIELDS = [
  { key: "parceiro", label: "Parceiro", required: true },
  { key: "endereco", label: "Endereço completo", required: true },
  { key: "cidade", label: "Cidade", required: false },
  { key: "uf", label: "UF", required: false },
  { key: "valor_mensal", label: "Valor mensal", required: true },
  { key: "id_etiqueta", label: "ID Etiqueta", required: false },
  { key: "nr_contrato", label: "Nº Contrato", required: false },
  { key: "cliente", label: "Cliente", required: false },
  { key: "status", label: "Status", required: false },
  { key: "codigo_sap", label: "Código SAP", required: false },
  { key: "banda_mbps", label: "Banda contratada (Mbps)", required: false },
  { key: "setup", label: "Setup", required: false },
  { key: "data_inicio", label: "Data início", required: false },
  { key: "data_fim", label: "Data fim", required: false },
  { key: "observacoes", label: "Observações", required: false },
];

type Step = "upload" | "sheet" | "mapping" | "summary";

/** Tenta extrair cidade e UF de um endereço brasileiro completo */
function parseCidadeUF(endereco: string): { cidade?: string; uf?: string } {
  if (!endereco) return {};
  // Padrões comuns: "Rua X, 123, Bairro, Cidade - UF, CEP" ou "Cidade/UF" ou "Cidade, UF"
  const ufMatch = endereco.match(/[-–,/\s]\s*([A-Z]{2})\s*(?:[,\s-–]|$)/);
  const uf = ufMatch ? ufMatch[1] : undefined;

  // Tenta pegar a cidade: texto antes do UF, depois da última vírgula/traço
  if (uf) {
    const beforeUF = endereco.substring(0, endereco.lastIndexOf(uf)).replace(/[-–,/\s]+$/, "");
    const parts = beforeUF.split(/[,\-–]+/).map(s => s.trim()).filter(Boolean);
    const cidade = parts.length > 0 ? parts[parts.length - 1].replace(/^\d{5}-?\d{3}\s*/, "").trim() : undefined;
    return { cidade: cidade || undefined, uf };
  }
  return {};
}

interface ImportSummary {
  total: number;
  newRecords: number;
  updated: number;
  ignored: number;
  errors: string[];
}

export default function ImportWizard({ isComplement = false }: { isComplement?: boolean }) {
  const [step, setStep] = useState<Step>("upload");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [rows, setRows] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [keyField, setKeyField] = useState<"id_etiqueta" | "nr_contrato" | "endereco">("id_etiqueta");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [profileName, setProfileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const { data: profiles } = useImportProfiles();
  const createProfile = useCreateImportProfile();
  const upsertCompras = useUpsertComprasLM();

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

  const applyProfile = (profileId: string) => {
    const p = profiles?.find((pr) => pr.id === profileId);
    if (p) {
      setMapping(p.column_mapping);
      setKeyField(p.key_field as any);
    }
  };

  const saveProfile = async () => {
    if (!profileName.trim()) return;
    await createProfile.mutateAsync({
      name: profileName.trim(),
      column_mapping: mapping,
      key_field: keyField,
      user_id: user?.id,
    });
    toast({ title: "Perfil salvo!" });
    setProfileName("");
  };

  const processImport = async () => {
    setImporting(true);
    const errors: string[] = [];
    const items: any[] = [];
    let ignored = 0;

    const keyIdx = mapping[keyField] ? headers.indexOf(mapping[keyField]) : -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;

      // Get mapped values
      const getValue = (field: string) => {
        const col = mapping[field];
        if (!col) return undefined;
        const idx = headers.indexOf(col);
        if (idx === -1) return undefined;
        const v = row[idx];
        return v === "" || v === null || v === undefined ? undefined : v;
      };

      const parceiro = getValue("parceiro");
      const endereco = getValue("endereco");
      const valorStr = getValue("valor_mensal");
      const keyValue = keyIdx >= 0 ? row[keyIdx] : undefined;

      // Skip completely empty rows silently
      if (!parceiro && !endereco && !valorStr) { continue; }
      
      // Validate required
      if (!parceiro) { errors.push(`Linha ${lineNum}: Parceiro vazio`); continue; }
      
      // For complement mode, we only need the key and merge fields
      if (isComplement) {
        // Tenta encontrar a melhor chave disponível na linha
        const possibleKeys: Array<"id_etiqueta" | "nr_contrato" | "endereco"> = ["id_etiqueta", "nr_contrato", "endereco"];
        let matchKey: string | undefined;
        let matchField: string | undefined;
        
        // Prioriza a chave selecionada, depois tenta as outras
        const orderedKeys = [keyField, ...possibleKeys.filter(k => k !== keyField)];
        for (const k of orderedKeys) {
          const v = k === "endereco" ? (endereco ? String(endereco) : undefined) : getValue(k);
          if (v) {
            matchKey = String(v);
            matchField = k;
            break;
          }
        }
        
        if (!matchKey || !matchField) { 
          errors.push(`Linha ${lineNum}: Nenhuma chave encontrada (ID, Contrato ou Endereço)`); 
          continue; 
        }
        
        const item: any = { [matchField]: matchKey, __matchField: matchField };
        // Only map merge-able fields
        const mergeFields = ["banda_mbps", "data_inicio", "data_fim", "setup", "status", "valor_mensal", "cliente", "observacoes", "codigo_sap"];
        for (const f of mergeFields) {
          const v = getValue(f);
          if (v !== undefined) {
            item[f] = ["banda_mbps", "valor_mensal", "setup"].includes(f) ? parseFloat(String(v)) || null : String(v);
          }
        }
        items.push(item);
        continue;
      }

      if (!endereco && !getValue("cidade")) { errors.push(`Linha ${lineNum}: Endereço ou Cidade vazio`); continue; }
      if (!valorStr && valorStr !== 0) { errors.push(`Linha ${lineNum}: Valor mensal vazio`); continue; }

      const valor = parseFloat(String(valorStr));
      if (isNaN(valor)) { errors.push(`Linha ${lineNum}: Valor mensal inválido`); continue; }

      const enderecoFull = endereco ? String(endereco) : `${getValue("cidade") || ""}, ${getValue("uf") || ""}`;

      // Auto-extrair cidade e UF do endereço quando não mapeados ou mapeados para a mesma coluna do endereço
      let cidadeVal = getValue("cidade");
      let ufVal = getValue("uf");
      // Se cidade/uf estão mapeados para a mesma coluna que endereço, tratar como auto-extração
      const enderecoCol = mapping["endereco"];
      if (enderecoCol && mapping["cidade"] === enderecoCol) cidadeVal = undefined;
      if (enderecoCol && mapping["uf"] === enderecoCol) ufVal = undefined;
      if ((!cidadeVal || !ufVal) && enderecoFull) {
        const parsed = parseCidadeUF(enderecoFull);
        if (!cidadeVal && parsed.cidade) cidadeVal = parsed.cidade;
        if (!ufVal && parsed.uf) ufVal = parsed.uf;
      }

      // Usar a chave selecionada se disponível, senão não definir (será INSERT puro)
      const hasKey = keyField === "endereco" 
        ? true 
        : (keyValue && String(keyValue).trim());

      const item: any = {
        parceiro: String(parceiro),
        endereco: enderecoFull,
        valor_mensal: valor,
        user_id: user?.id,
        geocoding_status: "pending",
        ...(cidadeVal ? { cidade: String(cidadeVal) } : {}),
        ...(ufVal ? { uf: String(ufVal) } : {}),
        __hasKey: !!hasKey,
      };
      
      // Set the key field value
      if (keyField !== "endereco" && hasKey) {
        item[keyField] = String(keyValue).trim();
      }

      // Optional fields
      const optMap: Record<string, string> = {
        cliente: "string", status: "string", codigo_sap: "string", observacoes: "string",
        nr_contrato: "string", id_etiqueta: "string",
        banda_mbps: "number", setup: "number",
        data_inicio: "string", data_fim: "string",
      };
      for (const [f, type] of Object.entries(optMap)) {
        if (f === keyField || f === "cidade" || f === "uf") continue;
        const v = getValue(f);
        if (v !== undefined) {
          item[f] = type === "number" ? (parseFloat(String(v)) || null) : String(v);
        }
      }

      items.push(item);
    }

    // Only dedup by business key (id_etiqueta/nr_contrato) if selected and available
    // Do NOT dedup by endereco — multiple contracts at same address are allowed
    const seenKeys = new Set<string>();
    const unique: any[] = [];
    
    for (const item of items) {
      if (keyField !== "endereco" && item[keyField]) {
        const kv = String(item[keyField]).trim();
        if (seenKeys.has(kv)) { ignored++; continue; }
        seenKeys.add(kv);
      }
      unique.push(item);
    }

    setSummary({
      total: rows.length,
      newRecords: unique.length,
      updated: 0,
      ignored,
      errors,
    });

    if (unique.length > 0) {
      try {
        await upsertCompras.mutateAsync({ items: unique });
        toast({ title: `${unique.length} registros importados com sucesso!` });

        // Background geocoding
        const itemsToGeocode = unique.filter(i => i.endereco && i.geocoding_status === "pending");
        geocodeInBackground(itemsToGeocode);
      } catch (err: any) {
        toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
      }
    }

    setImporting(false);
    setStep("summary");
  };

  const geocodeInBackground = async (items: any[]) => {
    const { supabase } = await import("@/integrations/supabase/client");
    for (const item of items) {
      try {
        const result = await geocodeAddress(item.endereco);
        if (result) {
          await supabase
            .from("lm_contracts")
            .update({ lat: result.lat, lng: result.lng, geocoding_status: "done" } as any)
            .eq("endereco_instalacao", item.endereco);
        } else {
          await supabase
            .from("lm_contracts")
            .update({ geocoding_status: "failed" } as any)
            .eq("endereco_instalacao", item.endereco);
        }
        // Rate limit between items
        await new Promise(r => setTimeout(r, 1100));
      } catch {
        // Continue with next item even if one fails
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
          {isComplement ? "Importar Complemento" : "Importação em Massa"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-3">
            {profiles && profiles.length > 0 && (
              <div>
                <label className="text-sm text-muted-foreground">Perfil salvo</label>
                <Select onValueChange={applyProfile}>
                  <SelectTrigger><SelectValue placeholder="Selecione um perfil (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => (
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

        {/* Step: Sheet selection */}
        {step === "sheet" && workbook && (
          <div className="space-y-3">
            <label className="text-sm font-medium">Selecione a aba:</label>
            {sheetNames.map(name => (
              <Button
                key={name}
                variant={selectedSheet === name ? "default" : "outline"}
                className="mr-2 mb-2"
                onClick={() => {
                  loadSheet(workbook, name);
                  setStep("mapping");
                }}
              >
                {name}
              </Button>
            ))}
          </div>
        )}

        {/* Step: Mapping */}
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

            {/* Key field selection */}
            <div>
              <label className="text-sm font-medium">Chave única para upsert:</label>
              <Select value={keyField} onValueChange={(v) => setKeyField(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="id_etiqueta">ID Etiqueta</SelectItem>
                  <SelectItem value="nr_contrato">Nº Contrato</SelectItem>
                  <SelectItem value="endereco">Endereço</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Column mapping */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Mapeamento de colunas:</label>
              {SYSTEM_FIELDS.filter(f => isComplement ? ["banda_mbps", "data_inicio", "data_fim", "setup", "status", "valor_mensal", keyField].includes(f.key) : true).map(field => (
                <div key={field.key} className="flex items-center gap-2">
                  <span className="text-sm w-44 shrink-0">
                    {field.label}
                    {field.required && !isComplement && <span className="text-destructive ml-1">*</span>}
                  </span>
                  <Select
                    value={mapping[field.key] || "__ignore__"}
                    onValueChange={(v) => setMapping(prev => ({ ...prev, [field.key]: v === "__ignore__" ? "" : v }))}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Ignorar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore__">Ignorar / Não existe</SelectItem>
                      {headers.filter(h => h !== "").map(h => (
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
                onChange={e => setProfileName(e.target.value)}
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

        {/* Step: Summary */}
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
