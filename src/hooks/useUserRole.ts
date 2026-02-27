import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "ws_user";

export function useUserRole() {
  const { user } = useAuth();

  const { data: roles, isLoading, fetchStatus } = useQuery({
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

  // When enabled transitions from false→true, isLoading can briefly be false
  // while fetchStatus is still 'idle'. We must treat that as loading.
  const stillLoading = isLoading || (!user?.id ? false : fetchStatus === "idle");

  return {
    roles: roles || [],
    isAdmin: roles?.includes("admin") || false,
    isWsUser: roles?.includes("ws_user") || false,
    isLoading: stillLoading,
  };
}
