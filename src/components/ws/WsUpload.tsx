import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSpeedToMbps, parseL2L, WS_COLUMN_LETTERS } from "@/lib/ws-utils";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, AlertTriangle, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/** Campos-alvo que o usuário pode mapear */
const BASE_TARGET_FIELDS = [
  { key: "designacao", label: "Designação" },
  { key: "cliente", label: "Cliente" },
  { key: "tipo_link", label: "Tipo de Link" },
  { key: "velocidade", label: "Velocidade" },
  { key: "endereco_a", label: "Endereço (Ponta A)" },
  { key: "cidade_a", label: "Cidade (Ponta A)" },
  { key: "uf_a", label: "UF (Ponta A)" },
  { key: "cep_a", label: "CEP (Ponta A)" },
  { key: "numero_a", label: "Número (Ponta A)" },
  { key: "endereco_b", label: "Endereço (Ponta B / L2L)" },
  { key: "cidade_b", label: "Cidade (Ponta B)" },
  { key: "uf_b", label: "UF (Ponta B)" },
  { key: "cep_b", label: "CEP (Ponta B)" },
  { key: "numero_b", label: "Número (Ponta B)" },
  { key: "prazo_ativacao", label: "Prazo de Ativação" },
  { key: "vigencia", label: "Vigência" },
  { key: "taxa_instalacao", label: "Taxa de Instalação" },
  { key: "bloco_ip", label: "Bloco IP" },
  { key: "cnpj_cliente", label: "CNPJ Cliente" },
  { key: "tipo_solicitacao", label: "Tipo de Solicitação" },
  { key: "valor_a_ser_vendido", label: "Valor a ser Vendido" },
  { key: "codigo_smark", label: "Código Smark" },
  { key: "produto", label: "Produto" },
  { key: "tecnologia", label: "Tecnologia" },
  { key: "tecnologia_meio_fisico", label: "Tecnologia (Meio Físico)" },
] as const;

// Coordinate fields for "Coordenadas" mode
const COORD_FIELDS = [
  { key: "coordenadas_a", label: "Coordenadas (Ponta A)" },
  { key: "coordenadas_b", label: "Coordenadas (Ponta B)" },
] as const;

// Coordinate fields for "Lat/Long" mode
const LATLONG_FIELDS = [
  { key: "lat_a", label: "Latitude (Ponta A)" },
  { key: "lng_a", label: "Longitude (Ponta A)" },
  { key: "lat_b", label: "Latitude (Ponta B)" },
  { key: "lng_b", label: "Longitude (Ponta B)" },
] as const;

type CoordFormat = "coords" | "latlong";

type TargetKey = (typeof BASE_TARGET_FIELDS)[number]["key"] | (typeof COORD_FIELDS)[number]["key"] | (typeof LATLONG_FIELDS)[number]["key"];

type Step = "upload" | "mapping" | "preview" | "done";

interface ParsedItem {
  row: number;
  designacao?: string;
  cliente?: string;
  tipo_link?: string;
  velocidade_original?: string;
  velocidade_mbps: number | null;
  is_l2l: boolean;
  l2l_suffix: string | null;
  l2l_pair_id: string | null;
  endereco_a?: string;
  cidade_a?: string;
  uf_a?: string;
  cep_a?: string;
  numero_a?: string;
  lat_a?: number;
  lng_a?: number;
  endereco_b?: string;
  cidade_b?: string;
  uf_b?: string;
  cep_b?: string;
  numero_b?: string;
  lat_b?: number;
  lng_b?: number;
  prazo_ativacao?: string;
  vigencia?: string;
  taxa_instalacao?: number;
  bloco_ip?: string;
  cnpj_cliente?: string;
  tipo_solicitacao?: string;
  valor_a_ser_vendido?: number;
  codigo_smark?: string;
  produto?: string;
  tecnologia?: string;
  tecnologia_meio_fisico?: string;
  coordenadas?: string;
  raw_data: Record<string, any>;
}

// ---- Hooks for WS Mapping Profiles ----
function useWsMappingProfiles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ws-mapping-profiles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ws_mapping_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; name: string; column_mapping: Record<string, string> }[];
    },
    enabled: !!user?.id,
  });
}

export default function WsUpload({ onBatchCreated }: { onBatchCreated?: (batchId: string) => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Record<TargetKey, string>>({} as any);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [profileName, setProfileName] = useState("");
  const [coordFormat, setCoordFormat] = useState<CoordFormat>("latlong");
  const fileRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profiles } = useWsMappingProfiles();

  // Save profile mutation
  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!profileName.trim() || !user?.id) return;
      const { error } = await supabase.from("ws_mapping_profiles").insert({
        user_id: user.id,
        name: profileName.trim(),
        column_mapping: mapping,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Perfil salvo!" });
      setProfileName("");
      queryClient.invalidateQueries({ queryKey: ["ws-mapping-profiles"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar perfil", description: err.message, variant: "destructive" });
    },
  });

  // Delete profile mutation
  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ws_mapping_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Perfil removido" });
      queryClient.invalidateQueries({ queryKey: ["ws-mapping-profiles"] });
    },
  });

  const applyProfile = (profileId: string) => {
    const p = profiles?.find((pr) => pr.id === profileId);
    if (p) setMapping(p.column_mapping as Record<TargetKey, string>);
  };

  // ---- Step 1: File upload ----
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (json.length < 2) {
        toast({ title: "Planilha vazia", variant: "destructive" });
        return;
      }
      const h = json[0].map((c: any, i: number) =>
        String(c).trim() || (i < WS_COLUMN_LETTERS.length ? `Col ${WS_COLUMN_LETTERS[i]}` : `Col ${i + 1}`)
      );
      setHeaders(h.slice(0, 23));
      setRows(json.slice(1));
      // Reset parsed data from previous upload
      setParsedItems([]);
      setSavedCount(0);
      setStep("mapping");
    };
    reader.readAsArrayBuffer(file);
  };

  // ---- Coordinate normalization helpers ----
  /** Clean and normalize a coordinate string: remove brackets, extra spaces, special chars */
  const normalizeCoordValue = (raw: string | undefined): number | undefined => {
    if (!raw) return undefined;
    const cleaned = raw.replace(/[^\d.,-]/g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? undefined : n;
  };

  /** Parse a combined coordinate string like "-23.5505, -46.6333" into lat/lng */
  const parseCoordString = (raw: string | undefined): { lat: number | undefined; lng: number | undefined } => {
    if (!raw) return { lat: undefined, lng: undefined };
    // Clean: remove brackets, parens, extra spaces
    const cleaned = raw.replace(/[[\](){}]/g, "").trim();
    // Try comma-separated
    const parts = cleaned.split(/[,;\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0].replace(",", "."));
      const lng = parseFloat(parts[1].replace(",", "."));
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
    return { lat: undefined, lng: undefined };
  };

  // ---- Step 2: Parse with mapping ----
  const parseData = () => {
    const items: ParsedItem[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const getValue = (key: TargetKey): string | undefined => {
        const col = mapping[key];
        if (!col) return undefined;
        const idx = headers.indexOf(col);
        if (idx === -1) return undefined;
        const v = row[idx];
        return v === "" || v === null || v === undefined ? undefined : String(v).trim();
      };

      const getNumber = (key: TargetKey): number | undefined => {
        const v = getValue(key);
        if (!v) return undefined;
        const n = parseFloat(String(v).replace(",", "."));
        return isNaN(n) ? undefined : n;
      };

      const endereco_a = getValue("endereco_a");
      if (!endereco_a && !getValue("designacao") && !getValue("cliente")) continue;

      const velRaw = getValue("velocidade");
      const desig = getValue("designacao");
      const l2l = parseL2L(desig);

      const raw: Record<string, any> = {};
      headers.forEach((h, hi) => {
        if (row[hi] !== "" && row[hi] !== null && row[hi] !== undefined) raw[h] = row[hi];
      });

      // Resolve coordinates based on format
      let lat_a: number | undefined;
      let lng_a: number | undefined;
      let lat_b: number | undefined;
      let lng_b: number | undefined;
      let coordenadas: string | undefined;

      if (coordFormat === "coords") {
        const coordsA = getValue("coordenadas_a");
        const coordsB = getValue("coordenadas_b");
        const parsedA = parseCoordString(coordsA);
        const parsedB = parseCoordString(coordsB);
        lat_a = parsedA.lat;
        lng_a = parsedA.lng;
        lat_b = parsedB.lat;
        lng_b = parsedB.lng;
        if (lat_a != null && lng_a != null) coordenadas = `${lat_a}, ${lng_a}`;
      } else {
        lat_a = normalizeCoordValue(getValue("lat_a"));
        lng_a = normalizeCoordValue(getValue("lng_a"));
        lat_b = normalizeCoordValue(getValue("lat_b"));
        lng_b = normalizeCoordValue(getValue("lng_b"));
        if (lat_a != null && lng_a != null) coordenadas = `${lat_a}, ${lng_a}`;
      }

      items.push({
        row: i + 2,
        designacao: desig,
        cliente: getValue("cliente"),
        tipo_link: getValue("tipo_link"),
        velocidade_original: velRaw,
        velocidade_mbps: normalizeSpeedToMbps(velRaw),
        is_l2l: l2l.isL2L,
        l2l_suffix: l2l.suffix,
        l2l_pair_id: l2l.pairId,
        endereco_a,
        cidade_a: getValue("cidade_a"),
        uf_a: getValue("uf_a"),
        cep_a: getValue("cep_a"),
        numero_a: getValue("numero_a"),
        lat_a,
        lng_a,
        endereco_b: getValue("endereco_b"),
        cidade_b: getValue("cidade_b"),
        uf_b: getValue("uf_b"),
        cep_b: getValue("cep_b"),
        numero_b: getValue("numero_b"),
        lat_b,
        lng_b,
        prazo_ativacao: getValue("prazo_ativacao"),
        vigencia: getValue("vigencia"),
        taxa_instalacao: getNumber("taxa_instalacao"),
        bloco_ip: getValue("bloco_ip"),
        cnpj_cliente: getValue("cnpj_cliente"),
        tipo_solicitacao: getValue("tipo_solicitacao"),
        valor_a_ser_vendido: getNumber("valor_a_ser_vendido"),
        codigo_smark: getValue("codigo_smark"),
        produto: getValue("produto"),
        tecnologia: getValue("tecnologia"),
        tecnologia_meio_fisico: getValue("tecnologia_meio_fisico"),
        coordenadas,
        raw_data: raw,
      });
    }
    }
    setParsedItems(items);
    setStep("preview");
  };

  // ---- Step 3: Save to DB ----
  const saveToDb = async () => {
    if (!user?.id || parsedItems.length === 0) return;
    setSaving(true);

    try {
      const { data: batch, error: batchErr } = await supabase
        .from("ws_batches")
        .insert({ user_id: user.id, file_name: fileName, total_items: parsedItems.length })
        .select("id")
        .single();

      if (batchErr || !batch) throw batchErr || new Error("Erro ao criar lote");

      const CHUNK = 500;
      let saved = 0;
      for (let i = 0; i < parsedItems.length; i += CHUNK) {
        const chunk = parsedItems.slice(i, i + CHUNK).map((item) => ({
          batch_id: batch.id,
          row_number: item.row,
          designacao: item.designacao || null,
          cliente: item.cliente || null,
          tipo_link: item.tipo_link || null,
          velocidade_original: item.velocidade_original || null,
          velocidade_mbps: item.velocidade_mbps,
          is_l2l: item.is_l2l,
          l2l_suffix: item.l2l_suffix,
          l2l_pair_id: item.l2l_pair_id,
          endereco_a: item.endereco_a || null,
          cidade_a: item.cidade_a || null,
          uf_a: item.uf_a || null,
          cep_a: item.cep_a || null,
          numero_a: item.numero_a || null,
          lat_a: item.lat_a ?? null,
          lng_a: item.lng_a ?? null,
          endereco_b: item.endereco_b || null,
          cidade_b: item.cidade_b || null,
          uf_b: item.uf_b || null,
          cep_b: item.cep_b || null,
          numero_b: item.numero_b || null,
          lat_b: item.lat_b ?? null,
          lng_b: item.lng_b ?? null,
          prazo_ativacao: item.prazo_ativacao || null,
          vigencia: item.vigencia || null,
          taxa_instalacao: item.taxa_instalacao ?? null,
          bloco_ip: item.bloco_ip || null,
          cnpj_cliente: item.cnpj_cliente || null,
          tipo_solicitacao: item.tipo_solicitacao || null,
          valor_a_ser_vendido: item.valor_a_ser_vendido ?? null,
          codigo_smark: item.codigo_smark || null,
          produto: item.produto || 'NT LINK DEDICADO FULL',
          tecnologia: item.tecnologia || 'GPON',
          tecnologia_meio_fisico: item.tecnologia_meio_fisico || 'Fibra',
          raw_data: item.raw_data,
        }));

        const { error } = await supabase.from("ws_feasibility_items").insert(chunk);
        if (error) throw error;
        saved += chunk.length;
        setSavedCount(saved);
      }

      await supabase.from("ws_batches").update({ status: "uploaded", total_items: saved }).eq("id", batch.id);

      toast({ title: `${saved} itens importados com sucesso!` });
      setStep("done");
      onBatchCreated?.(batch.id);
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({} as any);
    setParsedItems([]);
    setSavedCount(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const l2lCount = parsedItems.filter((i) => i.is_l2l).length;
  const noSpeedCount = parsedItems.filter((i) => i.velocidade_mbps === null && i.velocidade_original).length;
  const withCoordsA = parsedItems.filter((i) => i.lat_a != null).length;
  const withCoordsB = parsedItems.filter((i) => i.lat_b != null).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Upload de Planilha WS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione um arquivo XLSX/CSV com os dados de viabilidade. As colunas A-W serão lidas automaticamente.
            </p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Selecionar arquivo
            </Button>
          </div>
        )}

        {/* Step: Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {fileName} — {rows.length} linhas
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>
                Trocar arquivo
              </Button>
            </div>

            {/* Profiles */}
            {profiles && profiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Perfis salvos:</p>
                <div className="flex flex-wrap gap-2">
                  {profiles.map((p) => (
                    <div key={p.id} className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyProfile(p.id)}
                        className="text-xs"
                      >
                        {p.name}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => deleteProfile.mutate(p.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-x-auto max-h-36 border rounded-md">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-muted">
                    {headers.map((h, i) => (
                      <th key={i} className="px-2 py-1 text-left whitespace-nowrap font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 4).map((row, ri) => (
                    <tr key={ri} className="border-t">
                      {headers.map((_, ci) => (
                        <td key={ci} className="px-2 py-1 whitespace-nowrap max-w-[140px] truncate">
                          {String(row[ci] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Coordinate format selector */}
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <p className="text-sm font-medium">Formato de Coordenadas:</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="coordFormat" checked={coordFormat === "coords"} onChange={() => setCoordFormat("coords")} className="accent-primary" />
                  Coordenadas (Ponto A / Ponto B)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="coordFormat" checked={coordFormat === "latlong"} onChange={() => setCoordFormat("latlong")} className="accent-primary" />
                  Lat/Long separadas
                </label>
              </div>
            </div>

            {/* Column mapping */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Mapeamento de colunas:</p>
              {BASE_TARGET_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <span className="text-sm w-48 shrink-0">{field.label}</span>
                  <Select
                    value={mapping[field.key] || "__ignore__"}
                    onValueChange={(v) =>
                      setMapping((prev) => ({ ...prev, [field.key]: v === "__ignore__" ? "" : v }))
                    }
                  >
                    <SelectTrigger className="text-sm h-8">
                      <SelectValue placeholder="Ignorar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore__">— Ignorar —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {/* Coordinate-specific fields */}
              {(coordFormat === "coords" ? COORD_FIELDS : LATLONG_FIELDS).map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <span className="text-sm w-48 shrink-0">{field.label}</span>
                  <Select
                    value={mapping[field.key as TargetKey] || "__ignore__"}
                    onValueChange={(v) =>
                      setMapping((prev) => ({ ...prev, [field.key]: v === "__ignore__" ? "" : v }))
                    }
                  >
                    <SelectTrigger className="text-sm h-8">
                      <SelectValue placeholder="Ignorar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore__">— Ignorar —</SelectItem>
                      {headers.map((h) => (
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
                placeholder="Nome do perfil"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="text-sm h-8"
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1 shrink-0"
                disabled={!profileName.trim() || saveProfile.isPending}
                onClick={() => saveProfile.mutate()}
              >
                <Save className="h-3.5 w-3.5" /> Salvar perfil
              </Button>
            </div>

            <Button className="w-full" onClick={parseData} disabled={!mapping.endereco_a}>
              Pré-visualizar dados
            </Button>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{parsedItems.length} itens válidos</p>
              <Button variant="ghost" size="sm" onClick={() => setStep("mapping")}>
                Voltar
              </Button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{parsedItems.length} itens</Badge>
              {l2lCount > 0 && <Badge variant="outline">L2L: {l2lCount}</Badge>}
              {withCoordsA > 0 && <Badge variant="outline">Coords A: {withCoordsA}</Badge>}
              {withCoordsB > 0 && <Badge variant="outline">Coords B: {withCoordsB}</Badge>}
              {noSpeedCount > 0 && (
                <Badge variant="outline" className="gap-1 text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Vel. não reconhecida: {noSpeedCount}
                </Badge>
              )}
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto max-h-64 border rounded-md">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">Designação</th>
                    <th className="px-2 py-1 text-left">Cliente</th>
                    <th className="px-2 py-1 text-left">Vel. (Mbps)</th>
                    <th className="px-2 py-1 text-left">L2L</th>
                    <th className="px-2 py-1 text-left">Endereço A</th>
                    <th className="px-2 py-1 text-left">Lat A</th>
                    <th className="px-2 py-1 text-left">Lng A</th>
                    <th className="px-2 py-1 text-left">Endereço B</th>
                    <th className="px-2 py-1 text-left">Lat B</th>
                    <th className="px-2 py-1 text-left">Lng B</th>
                    <th className="px-2 py-1 text-left">Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.slice(0, 50).map((item, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{item.row}</td>
                      <td className="px-2 py-1 max-w-[100px] truncate">{item.designacao || "—"}</td>
                      <td className="px-2 py-1 max-w-[100px] truncate">{item.cliente || "—"}</td>
                      <td className="px-2 py-1">
                        {item.velocidade_mbps !== null ? item.velocidade_mbps : (
                          <span className="text-destructive">{item.velocidade_original || "—"}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {item.is_l2l ? <Badge variant="outline" className="text-xs px-1">{item.l2l_suffix}</Badge> : "—"}
                      </td>
                      <td className="px-2 py-1 max-w-[140px] truncate">{item.endereco_a || "—"}</td>
                      <td className="px-2 py-1">{item.lat_a?.toFixed(4) ?? "—"}</td>
                      <td className="px-2 py-1">{item.lng_a?.toFixed(4) ?? "—"}</td>
                      <td className="px-2 py-1 max-w-[140px] truncate">{item.endereco_b || "—"}</td>
                      <td className="px-2 py-1">{item.lat_b?.toFixed(4) ?? "—"}</td>
                      <td className="px-2 py-1">{item.lng_b?.toFixed(4) ?? "—"}</td>
                      <td className="px-2 py-1">{item.prazo_ativacao || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsedItems.length > 50 && (
              <p className="text-xs text-muted-foreground text-center">
                Mostrando 50 de {parsedItems.length} itens
              </p>
            )}

            <Button className="w-full gap-2" onClick={saveToDb} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando... ({savedCount}/{parsedItems.length})
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importar {parsedItems.length} itens
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
            <p className="font-medium">{savedCount} itens importados com sucesso!</p>
            <p className="text-sm text-muted-foreground">
              O lote está pronto para processamento de viabilidade.
            </p>
            <Button variant="outline" onClick={reset}>
              Novo upload
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
