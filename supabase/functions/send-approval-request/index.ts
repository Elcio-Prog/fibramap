import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Email sending is paused — internal approval flow only.

    // Auth: requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      preViabilidadeId,
      responsavelEmail,
      nivel,
      nivelLabel,
      motivo,
    } = body || {};

    if (!preViabilidadeId || !responsavelEmail || !motivo || nivel == null) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch full pre-viabilidade
    const { data: pv, error: pvErr } = await admin
      .from("pre_viabilidades")
      .select("*")
      .eq("id", preViabilidadeId)
      .single();
    if (pvErr || !pv) {
      return new Response(
        JSON.stringify({ error: "Pré-viabilidade não encontrada" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch requester profile name
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const solicitanteNome =
      profile?.full_name || profile?.display_name || user.email || "Solicitante";

    // Create token
    const { data: tokenRow, error: tokenErr } = await admin
      .from("aprovacao_tokens")
      .insert({
        pre_viabilidade_id: preViabilidadeId,
        responsavel_email: responsavelEmail,
        nivel,
        nivel_label: nivelLabel || `Nível ${nivel}`,
        motivo,
        solicitante_email: user.email,
        solicitante_nome: solicitanteNome,
      })
      .select("token")
      .single();
    if (tokenErr || !tokenRow) {
      throw new Error(`Erro ao criar token: ${tokenErr?.message}`);
    }

    // Update pre_viabilidade status
    await admin
      .from("pre_viabilidades")
      .update({
        status_aprovacao: "Pendente",
        motivo_solicitacao: motivo,
        modificado_por: solicitanteNome,
      })
      .eq("id", preViabilidadeId);

    // Email sending is paused — token + status update is sufficient for the
    // internal approval inbox.
    return new Response(
      JSON.stringify({ success: true, token: tokenRow.token, emailSent: false }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("send-approval-request error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
