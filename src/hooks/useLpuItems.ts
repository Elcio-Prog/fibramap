import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

export type LpuItem = Tables<"lpu_items">;

export function useLpuItems(providerId?: string) {
  return useQuery({
    queryKey: ["lpu_items", providerId],
    queryFn: async () => {
      let q = supabase.from("lpu_items").select("*").order("link_type");
      if (providerId) q = q.eq("provider_id", providerId);
      const { data, error } = await q;
      if (error) throw error;
      return data as LpuItem[];
    },
    enabled: !!providerId || providerId === undefined,
  });
}

export function useCreateLpuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: TablesInsert<"lpu_items">) => {
      const { data, error } = await supabase.from("lpu_items").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lpu_items"] }),
  });
}

export function useDeleteLpuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lpu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lpu_items"] }),
  });
}
