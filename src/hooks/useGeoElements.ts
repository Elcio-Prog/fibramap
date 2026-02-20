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
    let q = supabase.from("geo_elements").select("*").range(from, from + PAGE_SIZE - 1);
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

export function useBulkCreateGeoElements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: TablesInsert<"geo_elements">[]) => {
      const { error } = await supabase.from("geo_elements").insert(items);
      if (error) throw error;
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
