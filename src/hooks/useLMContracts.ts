import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LMContract {
  id: string;
  numero: number;
  user_id: string | null;

  status: string;
  pn: string | null;
  nome_pn: string | null;
  grupo: string | null;
  recorrencia: string | null;
  cont_guarda_chuva: string | null;
  modelo_tr: string | null;
  valor_mensal_tr: number;
  observacao_contrato_lm: string | null;
  item_sap: string | null;
  protocolo_elleven: string | null;
  nome_cliente: string | null;
  etiqueta: string | null;
  num_contrato_cliente: string | null;
  endereco_instalacao: string;

  data_assinatura: string | null;
  vigencia_meses: number | null;
  data_termino: string | null;

  is_last_mile: boolean;
  simples_nacional: boolean;
  observacao_geral: string | null;

  site_portal: string | null;
  login: string | null;
  senha: string | null;

  cidade: string | null;
  uf: string | null;
  lat: number | null;
  lng: number | null;
  geocoding_status: string;

  created_at: string;
  updated_at: string;
}

export type LMContractInput = Partial<Omit<LMContract, "id" | "created_at" | "updated_at">>;

export const LM_STATUS_OPTIONS = ["Ativo", "Cancelado", "Novo - A instalar"] as const;

export function useLMContracts() {
  return useQuery({
    queryKey: ["lm_contracts"],
    queryFn: async () => {
      const all: LMContract[] = [];
      let offset = 0;
      const batch = 1000;
      let more = true;
      while (more) {
        const { data, error } = await supabase
          .from("lm_contracts")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + batch - 1);
        if (error) throw error;
        if (data && data.length) {
          all.push(...(data as any as LMContract[]));
          offset += batch;
          more = data.length === batch;
        } else {
          more = false;
        }
      }
      return all;
    },
  });
}

/**
 * Insere todos os itens como novos registros.
 * O ID sequencial (numero) é gerado automaticamente pelo banco.
 */
export function useUpsertLMContracts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: LMContractInput[]) => {
      let inserted = 0;
      const batch = 500;
      for (let i = 0; i < items.length; i += batch) {
        const chunk = items.slice(i, i + batch);
        const { error } = await supabase.from("lm_contracts").insert(chunk as any);
        if (error) throw error;
        inserted += chunk.length;
      }
      return { inserted, upserted: 0, total: items.length };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lm_contracts"] }),
  });
}

export function useUpdateLMContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: LMContractInput & { id: string }) => {
      const { error } = await supabase
        .from("lm_contracts")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lm_contracts"] }),
  });
}

export function useDeleteLMContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lm_contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lm_contracts"] }),
  });
}

// ============= Mapeamento headers PT-BR ↔ campos DB =============

export const LM_FIELD_LABELS: Record<keyof LMContract, string> = {
  id: "ID",
  numero: "Nº",
  user_id: "User ID",
  status: "Status",
  pn: "PN",
  nome_pn: "Nome do PN",
  grupo: "Grupo",
  recorrencia: "Recorrência",
  cont_guarda_chuva: "Cont. Guarda-Chuva",
  modelo_tr: "Modelo (TR)",
  valor_mensal_tr: "Valor Mensal (TR)",
  observacao_contrato_lm: "Obs. Contrato LM",
  item_sap: "Item SAP",
  protocolo_elleven: "Protocolo Elleven",
  nome_cliente: "Nome do Cliente",
  etiqueta: "Etiqueta",
  num_contrato_cliente: "Nº Contrato Cliente",
  endereco_instalacao: "Endereço de Instalação",
  data_assinatura: "Data de Assinatura",
  vigencia_meses: "Vigência (meses)",
  data_termino: "Data de Término",
  is_last_mile: "É Last Mile?",
  simples_nacional: "Simples Nacional?",
  observacao_geral: "Observação Geral",
  site_portal: "Site Portal",
  login: "Login",
  senha: "Senha",
  cidade: "Cidade",
  uf: "UF",
  lat: "Latitude",
  lng: "Longitude",
  geocoding_status: "Status Geocodificação",
  created_at: "Criado em",
  updated_at: "Atualizado em",
};

/** Reverso: aceita variações em PT-BR (case/acento-insensível) e devolve o campo DB. */
export const LM_HEADER_TO_FIELD: Record<string, keyof LMContract> = (() => {
  const map: Record<string, keyof LMContract> = {};
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  Object.entries(LM_FIELD_LABELS).forEach(([field, label]) => {
    map[norm(label)] = field as keyof LMContract;
    map[norm(field)] = field as keyof LMContract;
  });
  return map;
})();
