import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Integracao {
  id: string;
  nome: string;
  url: string;
  token: string;
  tipo: string;
  ativo: boolean;
  descricao: string;
  created_at: string;
  updated_at: string;
}

export function useIntegracoes() {
  const qc = useQueryClient();

  const { data: integracoes = [], isLoading } = useQuery({
    queryKey: ["integracoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integracoes" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as Integracao[];
    },
  });

  const createIntegracao = useMutation({
    mutationFn: async (values: Partial<Integracao>) => {
      const { error } = await supabase
        .from("integracoes" as any)
        .insert(values as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integracoes"] }),
  });

  const updateIntegracao = useMutation({
    mutationFn: async ({ id, ...values }: Partial<Integracao> & { id: string }) => {
      const { error } = await supabase
        .from("integracoes" as any)
        .update({ ...values, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integracoes"] }),
  });

  const deleteIntegracao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("integracoes" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integracoes"] }),
  });

  return { integracoes, isLoading, createIntegracao, updateIntegracao, deleteIntegracao };
}
