import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ImportProfile {
  id: string;
  user_id: string | null;
  name: string;
  column_mapping: Record<string, string>;
  key_field: string;
  created_at: string;
}

export function useImportProfiles() {
  return useQuery({
    queryKey: ["import_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_profiles")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ImportProfile[];
    },
  });
}

export function useCreateImportProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: { name: string; column_mapping: Record<string, string>; key_field: string; user_id?: string }) => {
      const { data, error } = await supabase
        .from("import_profiles")
        .insert(profile as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import_profiles"] }),
  });
}

export function useDeleteImportProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("import_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import_profiles"] }),
  });
}
