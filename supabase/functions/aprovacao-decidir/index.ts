import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // GET: lookup token info (for the decision page)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await admin
        .from("aprovacao_tokens")
        .select(
          "id, token, pre_viabilidade_id, responsavel_email, nivel, nivel_label, motivo, solicitante_email, solicitante_nome, acao_realizada, acao_em, expires_at, comentario"
        )
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch pre-viabilidade summary
      const { data: pv } = await admin
        .from("pre_viabilidades")
        .select(
          "id, numero, nome_cliente, cnpj_cliente, endereco, produto_nt, vigencia, ticket_mensal, valor_minimo, previsao_roi, status_aprovacao, dados_precificacao"
        )
        .eq("id", data.pre_viabilidade_id)
        .maybeSingle();

      return new Response(JSON.stringify({ token: data, pre_viabilidade: pv }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: register decision
    if (req.method === "POST") {
      const body = await req.json();
      const { token, acao, comentario } = body || {};
      if (!token || !["aprovar", "reprovar"].includes(acao)) {
        return new Response(
          JSON.stringify({ error: "Token e ação válida obrigatórios" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: tk, error: tkErr } = await admin
        .from("aprovacao_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (tkErr || !tk) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (tk.acao_realizada) {
        return new Response(
          JSON.stringify({ error: `Decisão já registrada: ${tk.acao_realizada}` }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (new Date(tk.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Link expirado" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newStatus = acao === "aprovar" ? "Aprovado" : "Reprovado";

      // Update token
      await admin
        .from("aprovacao_tokens")
        .update({
          acao_realizada: acao,
          acao_em: new Date().toISOString(),
          comentario: comentario || null,
        })
        .eq("token", token);

      // Update pre-viabilidade
      await admin
        .from("pre_viabilidades")
        .update({
          status_aprovacao: newStatus,
          aprovado_por: tk.responsavel_email,
          comentarios_aprovador: comentario || null,
        })
        .eq("id", tk.pre_viabilidade_id);

      return new Response(JSON.stringify({ success: true, status: newStatus }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("aprovacao-decidir error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
