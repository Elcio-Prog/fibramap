import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://fibramap.lovable.app",
  "https://id-preview--0e81b9c8-14a6-450d-b23b-484015b8a5a5.lovable.app",
  "https://0e81b9c8-14a6-450d-b23b-484015b8a5a5.lovableproject.com",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const caller = { id: claimsData.claims.sub };

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .eq("is_active", true)
      .single();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Sem permissão de administrador" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    if (action === "create_user") {
      const { email, password, display_name, role } = params;
      const validRoles = ["admin", "ws_user", "vendedor", "implantacao", "lm"];
      const userRole = validRoles.includes(role) ? role : "ws_user";

      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email e senha obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: display_name || email },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: userRole });

      if (roleError) {
        console.error("[manage-ws-users] Role insert error:", roleError.message);
        return new Response(JSON.stringify({ error: "Erro ao atribuir papel ao usuário." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_users") {
      const filterRole = params.role || "ws_user";
      const { data: roles, error } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role, is_active, created_at, updated_at")
        .eq("role", filterRole)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((roles || []).map((r: any) => r.user_id))];
      const users = [];
      for (const uid of userIds) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(uid as string);
        const roleInfo = (roles || []).find((r: any) => r.user_id === uid);
        if (user) {
          users.push({
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.display_name || user.email,
            is_active: roleInfo?.is_active ?? true,
            created_at: roleInfo?.created_at,
          });
        }
      }

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_pending_users") {
      const { data: { users: allUsers }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
      if (listErr) throw listErr;

      const { data: allRoles, error: rolesErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id");
      if (rolesErr) throw rolesErr;

      const assignedIds = new Set((allRoles || []).map((r: any) => r.user_id));

      const pending = (allUsers || [])
        .filter((u: any) => !assignedIds.has(u.id))
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          display_name: u.user_metadata?.display_name || u.email,
          created_at: u.created_at,
        }));

      return new Response(JSON.stringify({ users: pending }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "assign_role") {
      const { user_id, role } = params;
      const validRoles = ["admin", "ws_user", "vendedor", "implantacao", "lm"];
      const targetRole = validRoles.includes(role) ? role : "ws_user";

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", user_id)
        .eq("role", targetRole)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ error: "Usuário já possui este papel" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id, role: targetRole });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle_user") {
      const { user_id, is_active, role } = params;
      const targetRole = role || "ws_user";
      const { error } = await supabaseAdmin
        .from("user_roles")
        .update({ is_active })
        .eq("user_id", user_id)
        .eq("role", targetRole);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change_role") {
      const { user_id, from_role, to_role } = params;
      if (!user_id || !from_role || !to_role) {
        return new Response(JSON.stringify({ error: "user_id, from_role e to_role obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Remove old role
      const { error: delErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .eq("role", from_role);
      if (delErr) throw delErr;

      // Check if target role already exists
      const { data: existingTarget } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", user_id)
        .eq("role", to_role)
        .single();

      if (existingTarget) {
        // Reactivate if exists
        await supabaseAdmin
          .from("user_roles")
          .update({ is_active: true })
          .eq("user_id", user_id)
          .eq("role", to_role);
      } else {
        const { error: insErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id, role: to_role });
        if (insErr) throw insErr;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const { user_id, new_password } = params;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: new_password,
      });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[manage-ws-users] Unexpected error:", err.message);
    return new Response(JSON.stringify({ error: "Ocorreu um erro interno. Tente novamente." }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
