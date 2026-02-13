import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

export type FeasibilityQuery = Tables<"feasibility_queries">;

export function useFeasibilityHistory() {
  return useQuery({
    queryKey: ["feasibility_queries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feasibility_queries")
        .select("*, providers(name, color)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateFeasibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: TablesInsert<"feasibility_queries">) => {
      const { data, error } = await supabase.from("feasibility_queries").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feasibility_queries"] }),
  });
}
