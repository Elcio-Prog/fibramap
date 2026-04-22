import { createClient } from "npm:@supabase/supabase-js@2";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

    // Create token (internal approval system)
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

    // --- Email notification (parallel, non-blocking) ---
    let emailSent = false;
    let emailError: string | null = null;

    if (LOVABLE_API_KEY && RESEND_API_KEY) {
      try {
        const pvNumero = pv.numero ?? "—";
        const pvCliente = pv.nome_cliente ?? "N/A";
        const pvEndereco = pv.endereco ?? "N/A";
        const pvProduto = pv.produto_nt ?? "N/A";

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #0f172a; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px;">🔔 Solicitação de Aprovação</h1>
            </div>
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="color: #334155; margin: 0 0 16px;">
                <strong>${solicitanteNome}</strong> solicita sua aprovação para a pré-viabilidade abaixo:
              </p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f1f5f9; font-weight: 600; color: #475569; width: 140px;">Nº</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #1e293b;">${pvNumero}</td></tr>
                <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f1f5f9; font-weight: 600; color: #475569;">Cliente</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #1e293b;">${pvCliente}</td></tr>
                <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f1f5f9; font-weight: 600; color: #475569;">Endereço</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #1e293b;">${pvEndereco}</td></tr>
                <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f1f5f9; font-weight: 600; color: #475569;">Produto</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #1e293b;">${pvProduto}</td></tr>
                <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f1f5f9; font-weight: 600; color: #475569;">Nível</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #1e293b;">${nivelLabel || `Nível ${nivel}`}</td></tr>
                <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f1f5f9; font-weight: 600; color: #475569;">Motivo</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: #1e293b;">${motivo}</td></tr>
              </table>
              <p style="color: #64748b; font-size: 14px; margin: 0;">
                Acesse o sistema FibraMap para aprovar ou rejeitar esta solicitação na aba <strong>Aprovações</strong>.
              </p>
            </div>
            <div style="background: #f1f5f9; padding: 12px 20px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">FibraMap — Sistema de Pré Viabilidade</p>
            </div>
          </div>
        `;

        const emailRes = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "FibraMap <onboarding@resend.dev>",
            to: [responsavelEmail],
            subject: `[FibraMap] Aprovação solicitada — PV #${pvNumero} (${pvCliente})`,
            html: htmlBody,
          }),
        });

        const emailData = await emailRes.json();
        if (emailRes.ok) {
          emailSent = true;
          console.log("Email sent successfully:", emailData);
        } else {
          emailError = `Resend error [${emailRes.status}]: ${JSON.stringify(emailData)}`;
          console.error("Email send failed:", emailError);
        }
      } catch (emailErr) {
        emailError = emailErr instanceof Error ? emailErr.message : "Email send error";
        console.error("Email send exception:", emailError);
      }
    } else {
      emailError = "Email keys not configured (LOVABLE_API_KEY or RESEND_API_KEY missing)";
      console.warn(emailError);
    }

    // Always succeed — email is best-effort, internal approval is the primary flow
    return new Response(
      JSON.stringify({
        success: true,
        token: tokenRow.token,
        emailSent,
        emailError: emailSent ? null : emailError,
      }),
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
