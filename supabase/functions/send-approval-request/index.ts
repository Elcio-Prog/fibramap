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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

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

    // Build URLs - use the app origin
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/+$/, "") ||
      "https://fibramap.lovable.app";
    const appOrigin = origin.split("/").slice(0, 3).join("/");
    const linkBase = `${appOrigin}/aprovacao/${tokenRow.token}`;

    // Build pricing details
    const dp = (pv.dados_precificacao as Record<string, any>) || {};
    const fmtMoney = (v: any) =>
      v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmt = (v: any) => (v == null || v === "" ? "—" : String(v));

    const pricingRows: string[] = [];
    const addRow = (label: string, value: string) => {
      pricingRows.push(
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#555;font-size:13px;">${label}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${value}</td></tr>`
      );
    };

    addRow("Nº Pré-Viabilidade", `#${pv.numero}`);
    addRow("Cliente", fmt(pv.nome_cliente));
    addRow("CNPJ", fmt(pv.cnpj_cliente));
    addRow("Endereço", fmt(pv.endereco));
    addRow("Produto NT", fmt(pv.produto_nt));
    addRow("Vigência", pv.vigencia ? `${pv.vigencia} meses` : "—");
    addRow("Ticket Mensal", fmtMoney(pv.ticket_mensal));
    addRow("Valor Mínimo", fmtMoney(pv.valor_minimo));
    addRow("Previsão ROI", pv.previsao_roi != null ? `${Number(pv.previsao_roi).toFixed(2)}%` : "—");
    if (dp.roiVigencia != null) addRow("ROI Limite (Vigência)", `${Number(dp.roiVigencia).toFixed(2)}%`);
    if (dp.precoLink != null) addRow("Preço Link", fmtMoney(dp.precoLink));
    if (dp.custoTotal != null) addRow("Custo Total", fmtMoney(dp.custoTotal));
    if (dp.equipamentos && Array.isArray(dp.equipamentos) && dp.equipamentos.length > 0) {
      const eqList = dp.equipamentos
        .map((e: any) => `${e.nome || e.equipamento || "?"}${e.quantidade ? ` (x${e.quantidade})` : ""}`)
        .join(", ");
      addRow("Equipamentos", eqList);
    }

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#0f172a;padding:20px 24px;color:#fff;">
          <h1 style="margin:0;font-size:18px;font-weight:600;">FibraMap · Solicitação de Aprovação</h1>
          <p style="margin:6px 0 0;font-size:13px;opacity:.85;">${nivelLabel || `Nível ${nivel}`}</p>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="margin:0 0 12px;font-size:14px;color:#333;">Olá,</p>
          <p style="margin:0 0 16px;font-size:14px;color:#333;line-height:1.5;">
            <strong>${solicitanteNome}</strong> solicitou sua aprovação para a pré-viabilidade abaixo.
          </p>
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:0 0 20px;border-radius:4px;">
            <p style="margin:0;font-size:13px;color:#78350f;"><strong>Motivo:</strong> ${motivo}</p>
          </div>

          <h2 style="font-size:14px;color:#0f172a;margin:0 0 8px;border-bottom:2px solid #0f172a;padding-bottom:4px;">Detalhes</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px;">
            ${pricingRows.join("")}
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:8px;">
                <a href="${linkBase}?acao=aprovar"
                   style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;">
                  ✓ Aprovar
                </a>
              </td>
              <td align="center" style="padding:8px;">
                <a href="${linkBase}?acao=reprovar"
                   style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;">
                  ✗ Reprovar
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 0;font-size:12px;color:#888;text-align:center;">
            Ou abra a página de decisão: <a href="${linkBase}" style="color:#0f172a;">${linkBase}</a>
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#aaa;text-align:center;">
            Este link expira em 30 dias.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    // Send via Resend gateway
    const resp = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "FibraMap Aprovações <onboarding@resend.dev>",
        to: [responsavelEmail],
        subject: `[FibraMap] Aprovação Pré-Viabilidade #${pv.numero} — ${nivelLabel || `Nível ${nivel}`}`,
        html,
      }),
    });

    const respData = await resp.json();
    if (!resp.ok) {
      console.error("Resend error", resp.status, respData);
      throw new Error(`Resend [${resp.status}]: ${JSON.stringify(respData)}`);
    }

    return new Response(
      JSON.stringify({ success: true, token: tokenRow.token, email: respData }),
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
