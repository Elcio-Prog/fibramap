import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload } from "lucide-react";
import { LMContract, LM_HEADER_TO_FIELD, useUpsertLMContracts } from "@/hooks/useLMContracts";

interface Props {
  open: boolean;
  onClose: () => void;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function parseDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function parseBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return ["sim", "yes", "true", "1", "s", "y"].includes(s);
}

function parseNumber(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function LMContractImport({ open, onClose }: Props) {
  const [rows, setRows] = useState<Partial<LMContract>[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const upsert = useUpsertLMContracts();

  const reset = () => {
    setRows([]);
    setFileName("");
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });

    const mapped: Partial<LMContract>[] = json.map((row) => {
      const out: any = {};
      Object.entries(row).forEach(([header, value]) => {
        const field = LM_HEADER_TO_FIELD[norm(header)];
        if (!field) return;
        if (field === "valor_mensal_tr") out[field] = parseNumber(value) ?? 0;
        else if (field === "vigencia_meses") out[field] = parseNumber(value);
        else if (field === "data_assinatura" || field === "data_termino") out[field] = parseDate(value);
        else if (field === "is_last_mile" || field === "simples_nacional") out[field] = parseBool(value);
        else out[field] = value === "" ? null : String(value);
      });
      // defaults
      if (!out.status) out.status = "Novo - A instalar";
      if (out.is_last_mile == null) out.is_last_mile = true;
      if (out.simples_nacional == null) out.simples_nacional = false;
      if (out.endereco_instalacao == null) out.endereco_instalacao = "";
      return out;
    });
    setRows(mapped);
  };

  const handleConfirm = async () => {
    try {
      const res = await upsert.mutateAsync(rows);
      toast.success(`${res.total} registro(s) importado(s) com sucesso.`);
      reset();
      onClose();
    } catch (e: any) {
      toast.error("Falha na importação", { description: e?.message ?? String(e) });
    }
  };

  const preview = rows.slice(0, 5);
  const previewCols = Array.from(
    preview.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  ).slice(0, 8);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar Contratos LM</DialogTitle>
          <DialogDescription>
            Aceita arquivos .xlsx e .csv. A deduplicação usa <code className="text-xs">Nº Contrato Cliente</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />
              <span>{fileName || "Escolher arquivo (.xlsx, .csv)"}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
            {rows.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {rows.length} linha(s) detectada(s)
              </span>
            )}
          </div>

          {preview.length > 0 && (
            <div className="rounded-md border">
              <div className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preview (5 primeiros registros)
              </div>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewCols.map((c) => <TableHead key={c} className="text-xs">{c}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={i}>
                        {previewCols.map((c) => (
                          <TableCell key={c} className="text-xs">
                            {typeof (r as any)[c] === "boolean"
                              ? ((r as any)[c] ? "Sim" : "Não")
                              : String((r as any)[c] ?? "—")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={upsert.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={rows.length === 0 || upsert.isPending}>
            {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar importação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
