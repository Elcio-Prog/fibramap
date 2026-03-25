import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ApiLog {
  id: string;
  created_at: string;
  integration_name: string;
  endpoint: string;
  method: string;
  request_params: any;
  response_status: number | null;
  response_ok: boolean | null;
  response_body: any;
  error_message: string | null;
  duration_ms: number | null;
}

export function useApiLogs(integration?: string) {
  return useQuery({
    queryKey: ["api_logs", integration],
    queryFn: async () => {
      let query = supabase
        .from("api_request_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (integration) {
        query = query.eq("integration_name", integration);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]) as ApiLog[];
    },
    refetchInterval: 15000,
  });
}
