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
  dados_precificacao: Record<string, any> | null;
  modificado_por: string | null;
  cnpj_cliente: string | null;
  coordenadas: string | null;
  endereco: string | null;
  protocolo: string | null;
  data_reavaliacao: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type PreViabilidadeInsert = Omit<PreViabilidade, "id" | "created_at" | "numero"> & { numero?: number };

export type PreViabilidadeUpdate = Partial<Omit<PreViabilidade, "id" | "created_at" | "user_id">>;

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

export function calculateIndividualROI(ticketMensal: number | null, dp: any) {
  if (!ticketMensal) return 0;
  const dados = dp || {};
  
  // CUSTO TOTAL = taxa_instalacao_lm + lancamento_custos_materiais + custo_radio + capex + valor_total_reais
  const custoTotal =
    (dados.custoLastMile ?? 0) +
    (dados.custosMateriaisAdicionais ?? 0) +
    (dados.custo_radio ?? 0) +
    (dados.valorCapex ?? 0) +
    (dados.valor_total_reais ?? 0);

  const usouFinder2 = dados.usou_finder2 ?? 0;
  const campanhaComercialMeses = dados.campanha_comercial_meses ?? 0;
  const taxaInstalacao = dados.taxaInstalacao ?? 0;
  const mediaMensalidadeLm = dados.media_mensalidade_lm ?? 0;
  const opex = dados.valorOpex ?? 0;

  // Receitas = Ticket Mensal - OPEX - Valor LM
  const receitas = ticketMensal - mediaMensalidadeLm - opex;

  if (receitas <= 0) return 0;

  // Despesas = Custo Total + Finder + Campanha - Taxa de Instalação
  const finder = ticketMensal * (usouFinder2 / 100);
  const despesas = custoTotal + finder + campanhaComercialMeses - taxaInstalacao;

  const roi = despesas / receitas;
  return Math.round(roi * 10) / 10;
}

export async function recalcRoiGlobal(idGuardachuva: string | null) {
  if (!idGuardachuva) return;

  // Fetch all records with the same id_guardachuva
  const { data, error } = await supabase
    .from("pre_viabilidades" as any)
    .select("id, ticket_mensal, valor_minimo, dados_precificacao, updated_at")
    .eq("id_guardachuva", idGuardachuva);

  if (error || !data || data.length === 0) return;

  const records = data as unknown as {
    id: string;
    ticket_mensal: number | null;
    valor_minimo: number | null;
    dados_precificacao: Record<string, any> | null;
    updated_at: string | null;
  }[];

  // Per-record calculation then sum across the group
  let somaReceitas = 0;
  let somaDespesas = 0;

  for (const r of records) {
    const dp = r.dados_precificacao || {};
    const ticketMensal = r.ticket_mensal ?? 0;
    const mediaMensalidadeLm = dp.media_mensalidade_lm ?? 0;

    // CUSTO TOTAL = taxa_instalacao_lm + lancamento_custos_materiais + custo_radio + capex + valor_total_reais
    const custoTotal =
      (dp.custoLastMile ?? 0) +
      (dp.custosMateriaisAdicionais ?? 0) +
      (dp.custo_radio ?? 0) +
      (dp.valorCapex ?? 0) +
      (dp.valor_total_reais ?? 0);

    const usouFinder2 = dp.usou_finder2 ?? 0;
    const campanhaComercialMeses = dp.campanha_comercial_meses ?? 0;
    const taxaInstalacao = dp.taxaInstalacao ?? 0;
    const opex = dp.valorOpex ?? 0;

    // Receita = Ticket Mensal Previsto - OPEX - Média Mensalidade LM
    const receita = ticketMensal - opex - mediaMensalidadeLm;

    // Despesa = Custo Total + (Ticket Mensal * (Usou FINDER2 / 100)) + Campanha Comercial Meses - Taxa de Instalação
    const despesa = custoTotal + (ticketMensal * (usouFinder2 / 100)) + campanhaComercialMeses - taxaInstalacao;

    somaReceitas += receita;
    somaDespesas += despesa;
  }

  let roi: number;
  if (somaReceitas <= 0) {
    roi = 0;
  } else {
    roi = somaDespesas / somaReceitas;
  }

  roi = Math.round(roi * 100) / 100;

  // Update all records in the group — the trigger preserves updated_at when only roi_global changes
  for (const r of records) {
    await supabase
      .from("pre_viabilidades" as any)
      .update({ roi_global: roi } as any)
      .eq("id", r.id);
  }
}

export function useDeletePreViabilidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pre_viabilidades" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pre-viabilidades"] });
    },
  });
}
