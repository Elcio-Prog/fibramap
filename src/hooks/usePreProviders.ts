import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PreProviderContact {
  id: string;
  titulo: string;
  nome: string;
  telefone_fixo: string;
  telefone_movel: string;
  email: string;
}

export interface PreProvider {
  id: string;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string;
  cidade_sede: string | null;
  estado_sede: string | null;
  has_cross_ntt: boolean;
  oferece_mancha: string | null;
  contato_comercial_nome: string | null;
  contato_comercial_fone: string | null;
  contato_comercial_email: string | null;
  contato_noc_nome: string | null;
  contato_noc_fone: string | null;
  contato_noc_email: string | null;
  contatos: PreProviderContact[] | null;
  observacoes: string | null;
  status: string;
  promoted_provider_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreProviderCity {
  id: string;
  pre_provider_id: string;
  cidade: string;
  estado: string | null;
  created_at: string;
}

export function usePreProviders() {
  return useQuery({
    queryKey: ["pre_providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pre_providers")
        .select("*")
        .order("nome_fantasia");
      if (error) throw error;
      return data as PreProvider[];
    },
  });
}

export function usePreProviderCities(preProviderId?: string | null) {
  return useQuery({
    queryKey: ["pre_provider_cities", preProviderId],
    enabled: !!preProviderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pre_provider_cities")
        .select("*")
        .eq("pre_provider_id", preProviderId!)
        .order("cidade");
      if (error) throw error;
      return data as PreProviderCity[];
    },
  });
}

export function useAllPreProviderCities() {
  return useQuery({
    queryKey: ["pre_provider_cities_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pre_provider_cities")
        .select("*")
        .order("cidade");
      if (error) throw error;
      return data as PreProviderCity[];
    },
  });
}

export function useCreatePreProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<PreProvider> & { nome_fantasia: string }) => {
      const { data, error } = await supabase.from("pre_providers").insert(p as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre_providers"] }),
  });
}

export function useUpdatePreProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...p }: Partial<PreProvider> & { id: string }) => {
      const { error } = await supabase.from("pre_providers").update(p as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre_providers"] }),
  });
}

export function useDeletePreProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pre_providers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre_providers"] }),
  });
}

export function useAddPreProviderCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { pre_provider_id: string; cidade: string; estado?: string }) => {
      const { data, error } = await supabase.from("pre_provider_cities").insert(c as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre_provider_cities"] }),
  });
}

export function useDeletePreProviderCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pre_provider_cities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre_provider_cities"] }),
  });
}

/** Promote a pre-provider to full provider */
export function usePromotePreProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (preProvider: PreProvider) => {
      // Create full provider
      const { data: newProvider, error: createErr } = await supabase
        .from("providers")
        .insert({
          name: preProvider.nome_fantasia,
          razao_social: preProvider.razao_social,
          has_cross_ntt: preProvider.has_cross_ntt,
          gerente_comercial: preProvider.contato_comercial_nome,
          telefone_gerente: preProvider.contato_comercial_fone,
          contato_comercial_email: preProvider.contato_comercial_email,
          contato_noc_nome: preProvider.contato_noc_nome,
          contato_noc_fone: preProvider.contato_noc_fone,
          contato_noc_email: preProvider.contato_noc_email,
          cidade_sede: preProvider.cidade_sede,
          estado_sede: preProvider.estado_sede,
          observacoes: preProvider.observacoes,
        } as any)
        .select()
        .single();
      if (createErr) throw createErr;

      // Update pre-provider status
      const { error: updateErr } = await supabase
        .from("pre_providers")
        .update({ status: "promovido", promoted_provider_id: newProvider.id } as any)
        .eq("id", preProvider.id);
      if (updateErr) throw updateErr;

      return newProvider;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pre_providers"] });
      qc.invalidateQueries({ queryKey: ["providers"] });
    },
  });
}
