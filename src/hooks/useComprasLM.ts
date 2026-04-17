import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Adapter legado: mantém a interface CompraLM (usada por BaseLMPage e ImportWizard)
 * mas opera sobre a nova tabela `lm_contracts`. Faz o mapeamento entre os campos
 * antigos (parceiro, valor_mensal, endereco, data_fim, ...) e os novos
 * (pn, valor_mensal_tr, endereco_instalacao, data_termino, ...).
 */
export interface CompraLM {
  id: string;
  user_id: string | null;
  parceiro: string;
  nome_pn: string | null;
  cliente: string | null;
  endereco: string;
  cidade: string | null;
  uf: string | null;
  id_etiqueta: string | null;
  nr_contrato: string | null;
  banda_mbps: number | null;
  valor_mensal: number;
  setup: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  observacoes: string | null;
  codigo_sap: string | null;
  lat: number | null;
  lng: number | null;
  geocoding_status: string;
  created_at: string;
  updated_at: string;
}

export type CompraLMInsert = Omit<CompraLM, "id" | "created_at" | "updated_at">;

function rowToCompra(row: any): CompraLM {
  return {
    id: row.id,
    user_id: row.user_id ?? null,
    parceiro: row.pn ?? "",
    cliente: row.nome_cliente ?? null,
    endereco: row.endereco_instalacao ?? "",
    cidade: row.cidade ?? null,
    uf: row.uf ?? null,
    id_etiqueta: row.etiqueta ?? null,
    nr_contrato: row.num_contrato_cliente ?? null,
    banda_mbps: null,
    valor_mensal: Number(row.valor_mensal_tr ?? 0),
    setup: null,
    data_inicio: row.data_assinatura ?? null,
    data_fim: row.data_termino ?? null,
    status: row.status ?? "",
    observacoes: row.observacao_geral ?? null,
    codigo_sap: row.item_sap ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    geocoding_status: row.geocoding_status ?? "pending",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function compraToRow(item: Partial<CompraLM>): Record<string, any> {
  const out: Record<string, any> = {};
  if (item.user_id !== undefined) out.user_id = item.user_id;
  if (item.parceiro !== undefined) out.pn = item.parceiro;
  if (item.cliente !== undefined) out.nome_cliente = item.cliente;
  if (item.endereco !== undefined) out.endereco_instalacao = item.endereco;
  if (item.cidade !== undefined) out.cidade = item.cidade;
  if (item.uf !== undefined) out.uf = item.uf;
  if (item.id_etiqueta !== undefined) out.etiqueta = item.id_etiqueta;
  if (item.nr_contrato !== undefined) out.num_contrato_cliente = item.nr_contrato;
  if (item.valor_mensal !== undefined) out.valor_mensal_tr = item.valor_mensal;
  if (item.data_inicio !== undefined) out.data_assinatura = item.data_inicio;
  if (item.data_fim !== undefined) out.data_termino = item.data_fim;
  if (item.status !== undefined) out.status = item.status;
  if (item.observacoes !== undefined) out.observacao_geral = item.observacoes;
  if (item.codigo_sap !== undefined) out.item_sap = item.codigo_sap;
  if (item.lat !== undefined) out.lat = item.lat;
  if (item.lng !== undefined) out.lng = item.lng;
  if (item.geocoding_status !== undefined) out.geocoding_status = item.geocoding_status;
  return out;
}

export function useComprasLM() {
  return useQuery({
    queryKey: ["compras_lm"],
    queryFn: async () => {
      const allData: CompraLM[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("lm_contracts")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allData.push(...data.map(rowToCompra));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }
      return allData;
    },
  });
}

export function useUpsertComprasLM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ items }: { items: Partial<CompraLM>[]; keyField?: string }) => {
      const batchSize = 500;
      const rows = items.map(compraToRow);
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from("lm_contracts").insert(batch as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compras_lm"] }),
  });
}

export function useCreateCompraLM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<CompraLM>) => {
      const { data, error } = await supabase
        .from("lm_contracts")
        .insert(compraToRow(item) as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compras_lm"] }),
  });
}

export function useUpdateCompraLM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompraLM> & { id: string }) => {
      const { error } = await supabase
        .from("lm_contracts")
        .update(compraToRow(updates) as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compras_lm"] }),
  });
}

export function useDeleteCompraLM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lm_contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compras_lm"] }),
  });
}
