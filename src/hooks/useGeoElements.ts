import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Json } from "@/integrations/supabase/types";

export type GeoElement = Tables<"geo_elements">;

const PAGE_SIZE = 1000;

async function fetchAllGeoElements(providerId?: string): Promise<GeoElement[]> {
  const allData: GeoElement[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let q = supabase
      .from("geo_elements")
      .select("*")
      .order("provider_id", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (providerId) q = q.eq("provider_id", providerId);
    const { data, error } = await q;
    if (error) throw error;
    if (data && data.length > 0) {
      allData.push(...(data as GeoElement[]));
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

export function useGeoElements(providerId?: string) {
  return useQuery({
    queryKey: ["geo_elements", providerId],
    queryFn: () => fetchAllGeoElements(providerId),
  });
}

const INSERT_CHUNK_SIZE = 500;

export function useBulkCreateGeoElements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      args:
        | TablesInsert<"geo_elements">[]
        | { items: TablesInsert<"geo_elements">[]; onProgress?: (inserted: number, total: number) => void }
    ) => {
      const items = Array.isArray(args) ? args : args.items;
      const onProgress = Array.isArray(args) ? undefined : args.onProgress;
      const total = items.length;

      for (let i = 0; i < total; i += INSERT_CHUNK_SIZE) {
        const chunk = items.slice(i, i + INSERT_CHUNK_SIZE);
        const { error } = await supabase.from("geo_elements").insert(chunk);
        if (error) {
          throw new Error(
            `Falha no lote ${Math.floor(i / INSERT_CHUNK_SIZE) + 1} (registros ${i + 1}-${i + chunk.length}): ${error.message}`
          );
        }
        onProgress?.(Math.min(i + chunk.length, total), total);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["geo_elements"] }),
  });
}

export function useDeleteGeoElementsByProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (providerId: string) => {
      const { error } = await supabase.from("geo_elements").delete().eq("provider_id", providerId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["geo_elements"] }),
  });
}
