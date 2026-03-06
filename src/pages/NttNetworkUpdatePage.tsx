import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProviders } from "@/hooks/useProviders";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Trash2, CheckCircle2, AlertTriangle, RefreshCw, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface ParsedRow {
  sigla_recipiente: string;
  tipo: "TA" | "CE";
  nome: string;
  sigla: string;
  pasta: string;
  tipo_splitter: string;
  qtd_portas: number;
  portas_ocupadas: number;
  portas_livres: number;
  portas_reservadas: number;
  lat: number;
  lng: number;
  has_1x2: boolean;
  has_des: boolean;
}

export default function NttNetworkUpdatePage() {
  const { data: providers } = useProviders();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<number>(0);
  const [fileName, setFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<{ date: string; count: number } | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const nttProvider = providers?.find(p => p.name.toLowerCase().includes("net turbo"));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      const headers = Object.keys(rows[0] || {});
      const colRecipiente = headers.find(h => /sigla.*recipiente/i.test(h)) || "Sigla (recipiente)";
      const colSigla = headers.find(h => h === "Sigla" || /^sigla$/i.test(h)) || "Sigla";
      const colPasta = headers.find(h => /pasta/i.test(h)) || "Pasta";
      const colTipo = headers.find(h => h === "Tipo" || /^tipo$/i.test(h)) || "Tipo";
      const colPortas = headers.find(h => /quantidade portas$/i.test(h)) || "Quantidade portas";
      const colOcupadas = headers.find(h => /ocupadas/i.test(h)) || "Portas ocupadas";
      const colLivres = headers.find(h => /livres/i.test(h)) || "Portas livres";
      const colReservadas = headers.find(h => /total.*reserv/i.test(h)) || "Total portas reservadas";
      const colLat = headers.find(h => /lat/i.test(h)) || "latitude";
      const colLng = headers.find(h => /lon/i.test(h)) || "longitude";

      const parsed: ParsedRow[] = [];
      let skipped = 0;

      for (const row of rows) {
        const siglaRec = String(row[colRecipiente] || "").trim();
        const lat = parseFloat(row[colLat]);
        const lng = parseFloat(row[colLng]);
        const tipoSplitter = String(row[colTipo] || "").trim();

        // Skip rows without coordinates or without valid TA/CE sigla
        if (isNaN(lat) || isNaN(lng) || (!siglaRec.startsWith("TA") && !siglaRec.startsWith("CE"))) {
          skipped++;
          continue;
        }

        const tipo: "TA" | "CE" = siglaRec.startsWith("TA") ? "TA" : "CE";
        const has_1x2 = /1x2/i.test(tipoSplitter);
        const has_des = /des/i.test(tipoSplitter);

        parsed.push({
          sigla_recipiente: siglaRec,
          tipo,
          nome: siglaRec,
          sigla: String(row[colSigla] || ""),
          pasta: String(row[colPasta] || ""),
          tipo_splitter: tipoSplitter,
          qtd_portas: parseInt(row[colPortas]) || 0,
          portas_ocupadas: parseInt(row[colOcupadas]) || 0,
          portas_livres: parseInt(row[colLivres]) || 0,
          portas_reservadas: parseInt(row[colReservadas]) || 0,
          lat,
          lng,
          has_1x2,
          has_des,
        });
      }

      setParsedRows(parsed);
      setSkippedRows(skipped);
      setStep("preview");
    } catch (err) {
      toast({ title: "Erro ao ler planilha", description: String(err), variant: "destructive" });
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleConfirmUpload = async () => {
    if (!nttProvider) {
      toast({ title: "Provedor Net Turbo não encontrado", variant: "destructive" });
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Step 1: Delete existing point geo_elements for NTT
      const { error: delError } = await supabase
        .from("geo_elements")
        .delete()
        .eq("provider_id", nttProvider.id)
        .eq("element_type", "point");

      if (delError) throw delError;

      // Step 2: Insert new elements in batches of 200
      const BATCH = 200;
      let inserted = 0;

      for (let i = 0; i < parsedRows.length; i += BATCH) {
        const batch = parsedRows.slice(i, i + BATCH).map(row => ({
          provider_id: nttProvider.id,
          element_type: "point" as const,
          geometry: {
            type: "Point",
            coordinates: [row.lng, row.lat],
          },
          properties: {
            tipo: row.tipo,
            nome: row.nome,
            sigla: row.sigla,
            pasta: row.pasta,
            tipo_splitter: row.tipo_splitter,
            tem_splitter: true,
            splitter_tem_1x2: row.has_1x2,
            splitter_tem_des: row.has_des,
            splitter_portas_livres: row.portas_livres,
            splitter_portas_total: row.qtd_portas,
            splitter_portas_ocupadas: row.portas_ocupadas,
            splitter_portas_reservadas: row.portas_reservadas,
            porta_disponivel: row.portas_livres > 0,
            splitter_atendimento_all_sim: row.portas_livres > 0,
          },
        }));

        const { error } = await supabase.from("geo_elements").insert(batch);
        if (error) throw error;

        inserted += batch.length;
        setProgress(Math.round((inserted / parsedRows.length) * 100));
      }

      queryClient.invalidateQueries({ queryKey: ["geo_elements"] });
      setLastUpdate({ date: new Date().toLocaleString("pt-BR"), count: inserted });
      setStep("done");
      toast({
        title: "Rede atualizada com sucesso",
        description: `${inserted} pontos (TAs/CEs) importados para ${nttProvider.name}`,
      });
    } catch (err) {
      toast({ title: "Erro ao atualizar rede", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const taCount = parsedRows.filter(r => r.tipo === "TA").length;
  const ceCount = parsedRows.filter(r => r.tipo === "CE").length;
  const withPortsCount = parsedRows.filter(r => r.portas_livres > 0).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Atualizar Rede NTT</h1>
        <p className="text-muted-foreground">
          Importe a planilha SPL para atualizar TAs e CEs da rede Net Turbo.
          Os pontos anteriores serão substituídos pelos novos.
        </p>
      </div>

      {!nttProvider && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Provedor "Net Turbo" não encontrado no cadastro. Cadastre-o primeiro na área de Provedores.
          </AlertDescription>
        </Alert>
      )}

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Selecionar Planilha SPL
            </CardTitle>
            <CardDescription>
              Formato esperado: planilha com colunas Sigla (recipiente), Tipo, Portas livres, latitude, longitude
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Arraste ou clique para selecionar o arquivo Excel</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="ntt-file"
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!nttProvider}>
                Selecionar Arquivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Prévia da Importação</CardTitle>
              <CardDescription>Arquivo: {fileName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary" className="text-sm">
                  {parsedRows.length} pontos válidos
                </Badge>
                <Badge variant="outline" className="text-sm">
                  {taCount} TAs
                </Badge>
                <Badge variant="outline" className="text-sm">
                  {ceCount} CEs
                </Badge>
                <Badge className="bg-emerald-500/10 text-emerald-600 text-sm">
                  {withPortsCount} com portas livres
                </Badge>
                {skippedRows > 0 && (
                  <Badge variant="destructive" className="text-sm">
                    {skippedRows} linhas ignoradas
                  </Badge>
                )}
              </div>

              <div className="max-h-64 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Sigla</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Splitter</TableHead>
                      <TableHead className="text-center">Portas</TableHead>
                      <TableHead className="text-center">Livres</TableHead>
                      <TableHead>Coord</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant={row.tipo === "TA" ? "default" : "secondary"} className="text-xs">
                            {row.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{row.nome}</TableCell>
                        <TableCell className="text-xs">{row.pasta}</TableCell>
                        <TableCell className="text-xs">{row.tipo_splitter}</TableCell>
                        <TableCell className="text-center text-xs">{row.qtd_portas}</TableCell>
                        <TableCell className="text-center">
                          <span className={row.portas_livres > 0 ? "text-emerald-600 font-semibold" : "text-destructive"}>
                            {row.portas_livres}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.lat.toFixed(4)}, {row.lng.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedRows.length > 20 && (
                  <p className="p-2 text-center text-xs text-muted-foreground">
                    ... e mais {parsedRows.length - 20} pontos
                  </p>
                )}
              </div>

              {uploading && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground text-center">{progress}% concluído</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  onClick={handleConfirmUpload}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {uploading ? "Atualizando..." : "Substituir Rede Atual"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setStep("upload"); setParsedRows([]); }}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {step === "done" && lastUpdate && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Rede atualizada com sucesso</h3>
              <p className="text-muted-foreground">
                {lastUpdate.count} pontos importados em {lastUpdate.date}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => { setStep("upload"); setParsedRows([]); setLastUpdate(null); }}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Nova Atualização
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
