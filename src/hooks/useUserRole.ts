import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "ws_user" | "vendedor" | "implantacao" | "lm";

export function useUserRole() {
  const { user } = useAuth();

  const { data: roles, status, fetchStatus } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (error) throw error;
      return (data || []).map((r: any) => r.role as AppRole);
    },
    enabled: !!user?.id,
  });

  const hasUser = !!user?.id;
  const isReady = !hasUser || status === "success";

  return {
    roles: roles || [],
    isAdmin: roles?.includes("admin") || false,
    isWsUser: roles?.includes("ws_user") || false,
    isVendedor: roles?.includes("vendedor") || false,
    isImplantacao: roles?.includes("implantacao") || false,
    isLm: roles?.includes("lm") || false,
    isLoading: !isReady,
  };
}
