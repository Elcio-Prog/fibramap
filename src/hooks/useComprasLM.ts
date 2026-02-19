import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompraLM {
  id: string;
  user_id: string | null;
  parceiro: string;
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

export function useComprasLM() {
  return useQuery({
    queryKey: ["compras_lm"],
    queryFn: async () => {
      // Fetch all rows using pagination (Supabase default limit is 1000)
      const allData: CompraLM[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("compras_lm")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allData.push(...(data as CompraLM[]));
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
    mutationFn: async ({
      items,
      keyField,
    }: {
      items: Partial<CompraLM>[];
      keyField: "id_etiqueta" | "nr_contrato" | "endereco";
    }) => {
      // Process in batches of 500
      const batchSize = 500;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const { error } = await supabase
          .from("compras_lm")
          .upsert(batch as any, { onConflict: keyField, ignoreDuplicates: false });
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
        .from("compras_lm")
        .insert(item as any)
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
        .from("compras_lm")
        .update(updates as any)
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
      const { error } = await supabase.from("compras_lm").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compras_lm"] }),
  });
}
