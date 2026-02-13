import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { Json } from "@/integrations/supabase/types";

export type GeoElement = Tables<"geo_elements">;

export function useGeoElements(providerId?: string) {
  return useQuery({
    queryKey: ["geo_elements", providerId],
    queryFn: async () => {
      let q = supabase.from("geo_elements").select("*");
      if (providerId) q = q.eq("provider_id", providerId);
      const { data, error } = await q;
      if (error) throw error;
      return data as GeoElement[];
    },
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
