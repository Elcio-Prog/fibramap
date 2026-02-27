import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "ws_user";

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

  // BULLETPROOF loading check:
  // If user is logged in, we MUST have successfully fetched roles before saying "not loading"
  // status === 'success' means we have actual data from the server
  const hasUser = !!user?.id;
  const isReady = !hasUser || status === "success";

  return {
    roles: roles || [],
    isAdmin: roles?.includes("admin") || false,
    isWsUser: roles?.includes("ws_user") || false,
    isLoading: !isReady,
  };
}
