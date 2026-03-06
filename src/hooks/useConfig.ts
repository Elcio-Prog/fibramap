import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FieldMappingEntry {
  colunaApp: string;
  campoJson: string;
  tipo: "string" | "number";
}

export interface WebhookConfig {
  url: string;
  token: string;
}

export function useConfig() {
  const qc = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes" as any)
        .select("chave, valor");
      if (error) throw error;
      const map: Record<string, any> = {};
      (data as any[])?.forEach((r: any) => { map[r.chave] = r.valor; });
      return map;
    },
  });

  const webhook: WebhookConfig = configs?.webhook || { url: "", token: "" };
  const fieldMapping: FieldMappingEntry[] = configs?.field_mapping || [];

  const saveConfig = useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: any }) => {
      const { error } = await supabase
        .from("configuracoes" as any)
        .update({ valor, updated_at: new Date().toISOString() } as any)
        .eq("chave", chave);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["configuracoes"] }),
  });

  return { webhook, fieldMapping, isLoading, saveConfig };
}
