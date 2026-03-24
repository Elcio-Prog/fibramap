import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

export interface PreViabilidade {
  id: string;
  numero: number;
  user_id: string;
  criado_por: string | null;
  status: string | null;
  tipo_solicitacao: string | null;
  produto_nt: string | null;
  vigencia: number | null;
  valor_minimo: number | null;
  viabilidade: string | null;
  ticket_mensal: number | null;
  status_aprovacao: string | null;
  aprovado_por: string | null;
  nome_cliente: string | null;
  previsao_roi: number | null;
  roi_global: number | null;
  status_viabilidade: string | null;
  projetista: string | null;
  motivo_solicitacao: string | null;
  observacoes: string | null;
  id_guardachuva: string | null;
  codigo_smark: string | null;
  inviabilidade_tecnica: string | null;
  comentarios_aprovador: string | null;
  observacao_validacao: string | null;
  origem: string | null;
  created_at: string;
}

export type PreViabilidadeInsert = Omit<PreViabilidade, "id" | "created_at">;

export type PreViabilidadeUpdate = Partial<Omit<PreViabilidade, "id" | "created_at" | "user_id" | "valor_minimo">>;

export function usePreViabilidades() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const query = useQuery({
    queryKey: ["pre-viabilidades", user?.id, isAdmin],
    queryFn: async () => {
      // RLS handles filtering: admin sees all, ws_user sees own
      const { data, error } = await supabase
        .from("pre_viabilidades" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PreViabilidade[];
    },
    enabled: !!user?.id,
  });

  return query;
}

export function useInsertPreViabilidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: PreViabilidadeInsert[]) => {
      const { error } = await supabase
        .from("pre_viabilidades" as any)
        .insert(items as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pre-viabilidades"] });
    },
  });
}

export function useUpdatePreViabilidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PreViabilidadeUpdate }) => {
      const { error } = await supabase
        .from("pre_viabilidades" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pre-viabilidades"] });
    },
  });
}
