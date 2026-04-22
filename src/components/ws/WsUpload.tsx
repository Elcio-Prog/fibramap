import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSpeedToMbps, parseL2L, WS_COLUMN_LETTERS } from "@/lib/ws-utils";
import { VIGENCIA_OPTIONS } from "@/lib/field-options";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, AlertTriangle, Save, Trash2, Pencil, Check, X, LayoutTemplate } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";

interface FieldDef { key: string; label: string; }
interface FieldGroup { label: string; fields: FieldDef[]; }

/** Grouped target fields for mapping UI */
const FIELD_GROUPS: FieldGroup[] = [
  {
    label: "Identificação",
    fields: [
      { key: "designacao", label: "Designação" },
      { key: "codigo_smark", label: "Código Smark" },
      { key: "tipo_solicitacao", label: "Tipo de Solicitação" },
      { key: "tipo_link", label: "Produto" },
    ],
  },
  {
    label: "Informações do Cliente",
    fields: [
      { key: "cliente", label: "Cliente" },
      { key: "cnpj_cliente", label: "CNPJ Cliente" },
    ],
  },
  {
    label: "Ponta A",
    fields: [
      { key: "endereco_a", label: "Endereço (Ponta A)" },
      { key: "numero_a", label: "Número (Ponta A)" },
      { key: "cidade_a", label: "Cidade (Ponta A)" },
      { key: "uf_a", label: "UF (Ponta A)" },
      { key: "cep_a", label: "CEP (Ponta A)" },
    ],
  },
  {
    label: "Ponta B",
    fields: [
      { key: "endereco_b", label: "Endereço (Ponta B / L2L)" },
      { key: "numero_b", label: "Número (Ponta B)" },
      { key: "cidade_b", label: "Cidade (Ponta B)" },
      { key: "uf_b", label: "UF (Ponta B)" },
      { key: "cep_b", label: "CEP (Ponta B)" },
    ],
  },
  {
    label: "Comercial",
    fields: [
      { key: "velocidade", label: "Velocidade" },
      { key: "valor_a_ser_vendido", label: "Valor a ser Vendido" },
      { key: "vigencia", label: "Vigência" },
      { key: "taxa_instalacao", label: "Taxa de Instalação" },
      { key: "prazo_ativacao", label: "Prazo de Ativação" },
    ],
  },
  {
    label: "Técnico",
    fields: [
      { key: "tecnologia", label: "Tecnologia" },
      { key: "tecnologia_meio_fisico", label: "Tecnologia (Meio Físico)" },
      { key: "bloco_ip", label: "Bloco IP" },
    ],
  },
];

// Flat list of all base fields for parsing
const BASE_TARGET_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);

// Coordinate fields for "Coordenadas" mode
const COORD_FIELDS: FieldDef[] = [
  { key: "coordenadas_a", label: "Coordenadas (Ponta A)" },
  { key: "coordenadas_b", label: "Coordenadas (Ponta B)" },
];

// Coordinate fields for "Lat/Long" mode
const LATLONG_FIELDS: FieldDef[] = [
  { key: "lat_a", label: "Latitude (Ponta A)" },
  { key: "lng_a", label: "Longitude (Ponta A)" },
  { key: "lat_b", label: "Latitude (Ponta B)" },
  { key: "lng_b", label: "Longitude (Ponta B)" },
];

type CoordFormat = "coords" | "latlong";

type TargetKey = string;

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

function useWsMappingTemplates() {
  return useQuery({
    queryKey: ["ws-mapping-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ws_mapping_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; column_mapping: Record<string, string> }[];
    },
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
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const [coordFormat, setCoordFormat] = useState<CoordFormat>("latlong");
  const [selectedVigencias, setSelectedVigencias] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profiles } = useWsMappingProfiles();
  const { data: templates } = useWsMappingTemplates();
  const { isAdmin } = useUserRole();
  const [templateName, setTemplateName] = useState("");

  // Save profile mutation
  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!profileName.trim() || !user?.id) return;
      const trimmed = profileName.trim();
      const isDuplicate = profiles?.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (isDuplicate) throw new Error("Já existe um perfil com esse nome.");
      const mappingWithMeta = {
        ...mapping,
        ...(selectedVigencias.length > 0 ? { __vigencias__: selectedVigencias.join(",") } : {}),
      };
      const { error } = await supabase.from("ws_mapping_profiles").insert({
        user_id: user.id,
        name: trimmed,
        column_mapping: mappingWithMeta,
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

  // Rename profile mutation
  const renameProfile = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Nome não pode ser vazio.");
      const isDuplicate = profiles?.some((p) => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase());
      if (isDuplicate) throw new Error("Já existe um perfil com esse nome.");
      const { error } = await supabase.from("ws_mapping_profiles").update({ name: trimmed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Perfil renomeado!" });
      setEditingProfileId(null);
      setEditingProfileName("");
      queryClient.invalidateQueries({ queryKey: ["ws-mapping-profiles"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao renomear", description: err.message, variant: "destructive" });
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

  // Save template mutation (admin only)
  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!templateName.trim() || !user?.id) return;
      const trimmed = templateName.trim();
      const isDuplicate = templates?.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
      if (isDuplicate) throw new Error("Já existe um template com esse nome.");
      const mappingWithMeta = {
        ...mapping,
        ...(selectedVigencias.length > 0 ? { __vigencias__: selectedVigencias.join(",") } : {}),
      };
      const { error } = await (supabase as any).from("ws_mapping_templates").insert({
        created_by: user.id,
        name: trimmed,
        column_mapping: mappingWithMeta,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Template salvo!" });
      setTemplateName("");
      queryClient.invalidateQueries({ queryKey: ["ws-mapping-templates"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar template", description: err.message, variant: "destructive" });
    },
  });

  // Delete template mutation (admin only)
  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("ws_mapping_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Template removido" });
      queryClient.invalidateQueries({ queryKey: ["ws-mapping-templates"] });
    },
  });

  const applyMapping = (m: Record<string, string>) => {
    const vigencias = m.__vigencias__ ? (m.__vigencias__ as string).split(",") : [];
    setSelectedVigencias(vigencias);
    const { __vigencias__, ...rest } = m;
    setMapping(rest);
  };

  const applyProfile = (profileId: string) => {
    const p = profiles?.find((pr) => pr.id === profileId);
    if (p) applyMapping(p.column_mapping as Record<string, string>);
  };

  const applyTemplate = (templateId: string) => {
    const t = templates?.find((tpl) => tpl.id === templateId);
    if (t) applyMapping(t.column_mapping as Record<string, string>);
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
      setHeaders(h);
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
    setParsedItems(items);
    setStep("preview");
  };

  // ---- Step 3: Save to DB ----
  const saveToDb = async () => {
    if (!user?.id || parsedItems.length === 0) return;
    setSaving(true);

    try {
      const batchMetadata: Record<string, any> = {};
      if (selectedVigencias.length > 0) batchMetadata.vigencias = selectedVigencias;
      // Store valor_min mapping keys so processor knows which columns to show
      const valorMinMapping: Record<string, string> = {};
      if (mapping["valor_min_calculado"]) valorMinMapping["valor_min_calculado"] = mapping["valor_min_calculado"];
      selectedVigencias.forEach(v => {
        const k = `valor_min_${v}`;
        if (mapping[k]) valorMinMapping[k] = mapping[k];
      });
      if (Object.keys(valorMinMapping).length > 0) batchMetadata.valor_min_mapping = valorMinMapping;

      const { data: batch, error: batchErr } = await supabase
        .from("ws_batches")
        .insert({ user_id: user.id, file_name: fileName, total_items: parsedItems.length, metadata: batchMetadata } as any)
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
          tipo_solicitacao: item.tipo_solicitacao || 'Nova Ativação',
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
                      {editingProfileId === p.id ? (
                        <>
                          <Input
                            value={editingProfileName}
                            onChange={(e) => setEditingProfileName(e.target.value)}
                            className="text-xs h-7 w-36"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameProfile.mutate({ id: p.id, name: editingProfileName });
                              if (e.key === "Escape") setEditingProfileId(null);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={!editingProfileName.trim() || renameProfile.isPending}
                            onClick={() => renameProfile.mutate({ id: p.id, name: editingProfileName })}
                          >
                            <Check className="h-3 w-3 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingProfileId(null)}
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </>
                      ) : (
                        <>
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
                            onClick={() => { setEditingProfileId(p.id); setEditingProfileName(p.name); }}
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => deleteProfile.mutate(p.id)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Templates (universal) */}
            {templates && templates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <LayoutTemplate className="h-3.5 w-3.5" /> Templates:
                </p>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(t.id)}
                        className="text-xs border-primary/30 bg-primary/5"
                      >
                        {t.name}
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => deleteTemplate.mutate(t.id)}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Vigência multi-select */}
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <p className="text-sm font-medium">Vigências para Valor Mínimo:</p>
              <p className="text-xs text-muted-foreground">
                Selecione as vigências para as quais deseja mapear colunas de resultado (Valor Mínimo).
              </p>
              <div className="flex flex-wrap gap-3">
                {VIGENCIA_OPTIONS.map((v) => (
                  <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedVigencias.includes(v)}
                      onCheckedChange={(checked) => {
                        setSelectedVigencias((prev) =>
                          checked ? [...prev, v] : prev.filter((x) => x !== v)
                        );
                        // Remove mapping for unchecked vigência
                        if (!checked) {
                          setMapping((prev) => {
                            const next = { ...prev };
                            delete next[`valor_min_${v}`];
                            return next;
                          });
                        }
                      }}
                    />
                    {v} meses
                  </label>
                ))}
              </div>
            </div>

            {/* Column mapping - grouped */}
            <div className="space-y-4">
              <p className="text-sm font-medium">Mapeamento de colunas:</p>
              {(() => {
                // Compute used columns for exclusion
                const usedColumns = new Set(
                  Object.values(mapping).filter((v) => v && v !== "__ignore__")
                );

                const renderField = (field: FieldDef) => {
                  const currentVal = mapping[field.key] || "";
                  const isMapped = !!currentVal;
                  return (
                    <div key={field.key} className="flex items-center gap-2">
                      <span className={`text-sm w-48 shrink-0 flex items-center gap-1.5 ${isMapped ? "text-primary font-medium" : ""}`}>
                        {isMapped && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                        {field.label}
                      </span>
                      <Select
                        value={currentVal || "__ignore__"}
                        onValueChange={(v) =>
                          setMapping((prev) => ({ ...prev, [field.key]: v === "__ignore__" ? "" : v }))
                        }
                      >
                        <SelectTrigger className="text-sm h-8">
                          <SelectValue placeholder="Ignorar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ignore__">— Ignorar —</SelectItem>
                          {headers.map((h) => {
                            // Show if: it's the current value for this field, or it's not used elsewhere
                            if (usedColumns.has(h) && currentVal !== h) return null;
                            return <SelectItem key={h} value={h}>{h}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                };

                // Determine coordinate group
                const coordGroup: FieldGroup = coordFormat === "coords"
                  ? { label: "Coordenadas", fields: COORD_FIELDS }
                  : { label: "Coordenadas (Lat/Long)", fields: LATLONG_FIELDS };

                const allGroups = [
                  ...FIELD_GROUPS.slice(0, 2), // Identificação, Cliente
                  { ...FIELD_GROUPS[2], fields: [...FIELD_GROUPS[2].fields] }, // Ponta A
                  { ...FIELD_GROUPS[3], fields: [...FIELD_GROUPS[3].fields] }, // Ponta B
                  ...FIELD_GROUPS.slice(4), // Comercial, Técnico
                ];

                // Insert coord fields into Ponta A / Ponta B
                if (coordFormat === "coords") {
                  allGroups[2].fields.push(COORD_FIELDS[0]); // Coordenadas Ponta A
                  allGroups[3].fields.push(COORD_FIELDS[1]); // Coordenadas Ponta B
                } else {
                  allGroups[2].fields.push(LATLONG_FIELDS[0], LATLONG_FIELDS[1]); // Lat/Lng A
                  allGroups[3].fields.push(LATLONG_FIELDS[2], LATLONG_FIELDS[3]); // Lat/Lng B
                }

                // Add result mapping group (calculated value + dynamic vigências)
                {
                  const resultFields: FieldDef[] = [
                    { key: "valor_min_calculado", label: "Valor Mín. Calculado (sistema)" },
                  ];
                  if (selectedVigencias.length > 0) {
                    selectedVigencias.forEach((v) => {
                      resultFields.push({
                        key: `valor_min_${v}`,
                        label: `Valor Mín. ${v} meses`,
                      });
                    });
                  }
                  allGroups.push({
                    label: "Resultado — Valor Mínimo",
                    fields: resultFields,
                  });
                }

                return allGroups.map((group) => (
                  <div key={group.label} className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t">
                      {group.label}
                    </p>
                    {group.fields.map(renderField)}
                  </div>
                ));
              })()}
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

            {/* Save template (admin only) */}
            {isAdmin && (
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do template"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="text-sm h-8"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 shrink-0 border-primary/30"
                  disabled={!templateName.trim() || saveTemplate.isPending}
                  onClick={() => saveTemplate.mutate()}
                >
                  <LayoutTemplate className="h-3.5 w-3.5" /> Salvar Template
                </Button>
              </div>
            )}

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
            {(() => {
              const previewCols: { key: string; label: string }[] = [
                { key: "row", label: "#" },
              ];
              // Add all mapped fields dynamically
              const allFields = [
                ...FIELD_GROUPS.flatMap((g) => g.fields),
                ...(coordFormat === "coords" ? COORD_FIELDS : LATLONG_FIELDS),
              ];
              for (const f of allFields) {
                if (mapping[f.key as TargetKey]) {
                  previewCols.push({ key: f.key, label: f.label });
                }
              }
              // Always show L2L and velocidade_mbps
              if (!previewCols.find((c) => c.key === "velocidade")) {
                // velocidade is parsed into velocidade_mbps
              }
              previewCols.push({ key: "velocidade_mbps", label: "Vel. (Mbps)" });
              previewCols.push({ key: "is_l2l", label: "L2L" });

              const getCellValue = (item: ParsedItem, key: string) => {
                if (key === "row") return item.row;
                if (key === "velocidade_mbps") {
                  return item.velocidade_mbps !== null
                    ? item.velocidade_mbps
                    : item.velocidade_original || "—";
                }
                if (key === "is_l2l") return item.is_l2l ? item.l2l_suffix : "—";
                const val = (item as any)[key];
                if (val === undefined || val === null || val === "") return "—";
                if (typeof val === "number" && (key.startsWith("lat") || key.startsWith("lng")))
                  return val.toFixed(4);
                return String(val);
              };

              return (
                <div className="overflow-x-auto max-h-64 border rounded-md">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-muted">
                        {previewCols.map((col) => (
                          <th key={col.key} className="px-2 py-1 text-left whitespace-nowrap">{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedItems.slice(0, 50).map((item, i) => (
                        <tr key={i} className="border-t">
                          {previewCols.map((col) => (
                            <td key={col.key} className="px-2 py-1 max-w-[150px] truncate whitespace-nowrap">
                              {getCellValue(item, col.key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

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
