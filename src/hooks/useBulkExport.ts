import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart, CartItem } from "@/contexts/CartContext";
import { useConfig, FieldMappingEntry } from "@/hooks/useConfig";
import { supabase } from "@/integrations/supabase/client";

async function callWebhookProxy(webhookUrl: string, items: any[], solicitante: string): Promise<{ status: number; body: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const resp = await fetch(
    `https://${projectId}.supabase.co/functions/v1/webhook-proxy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        webhookUrl,
        finalBody: { payload: items, solicitante, dataEnvio: new Date().toISOString() },
      }),
    }
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Proxy error: ${resp.status} - ${text}`);
  }
  return resp.json();
}

const BATCH_SIZE = 200;

function sanitizeString(v: any): string {
  if (v == null) return "";
  return String(v).trim().replace(/[\x00-\x1F]/g, "");
}

function castValue(v: any, tipo: string): any {
  if (v == null || v === "") return null;
  if (tipo === "number") {
    const n = parseFloat(String(v));
    return isNaN(n) ? null : n;
  }
  return sanitizeString(v);
}

function mapItemToColumnValue(item: CartItem, colunaApp: string): any {
  const map: Record<string, any> = {
    "Designação": item.designacao,
    "Cliente": item.cliente,
    "CNPJ": item.cnpj_cliente,
    "Endereço": item.endereco,
    "Cidade": item.cidade,
    "Geo": item.coordenadas || (item.lat != null && item.lng != null ? `${item.lat},${item.lng}` : ""),
    "Viável": item.is_viable ? "VIÁVEL" : item.is_check_om ? "Checar O&M disponibilidade" : "INVIÁVEL",
    "Melhor Etapa": item.stage,
    "Provedor": item.provider_name,
    "Vel.": item.velocidade_mbps,
    "Distância": item.distance_m,
    "Vigência": item.vigencia,
    "Taxa Inst.": item.taxa_instalacao,
    "Vlr Venda": item.valor_a_ser_vendido,
    "Bloco IP": item.bloco_ip,
    "Tipo Sol.": item.tipo_solicitacao,
    "Cód. Smark": item.codigo_smark,
    "Obs. Usuário": item.observacoes_user,
    "Obs. Sistema": item.observacoes_system,
    "Produto": item.produto,
    "Tecnologia": item.tecnologia,
    "Tecnologia (Meio Físico)": item.tecnologia_meio_fisico,
    "Coordenadas": item.coordenadas || (item.lat != null && item.lng != null ? `${item.lat},${item.lng}` : ""),
  };
  return map[colunaApp] ?? null;
}

function buildPayloadItem(item: CartItem, mapping: FieldMappingEntry[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const m of mapping) {
    const raw = mapItemToColumnValue(item, m.colunaApp);
    obj[m.campoJson] = castValue(raw, m.tipo);
  }
  obj.dataAnalise = item.created_at;
  obj.origemLista = item.batchTitle;
  return obj;
}

/** Required fields that must be filled before sending */
export const REQUIRED_CART_FIELDS: { key: keyof CartItem; label: string }[] = [
  { key: "produto", label: "Produto" },
  { key: "vigencia", label: "Vigência" },
  { key: "taxa_instalacao", label: "Taxa de Instalação" },
  { key: "velocidade_mbps", label: "Velocidade" },
  { key: "tecnologia", label: "Tecnologia" },
  { key: "valor_a_ser_vendido", label: "Valor Vendido" },
];

export function getIncompleteItems(items: CartItem[]): CartItem[] {
  return items.filter((item) =>
    REQUIRED_CART_FIELDS.some((f) => {
      const v = item[f.key];
      return v == null || v === "";
    })
  );
}

export function useBulkExport() {
  const { user } = useAuth();
  const { items, markAsSent } = useCart();
  const { webhook, fieldMapping } = useConfig();
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!webhook.url) return "Configure o Webhook em Configurações antes de enviar";
    if (!user?.email) return "Usuário sem email";
    if (items.length === 0) return "Carrinho vazio";
    const incomplete = getIncompleteItems(items);
    if (incomplete.length > 0) return `${incomplete.length} registros com campos obrigatórios não preenchidos`;
    return null;
  };

  const send = async () => {
    const err = validate();
    if (err) { setError(err); return false; }

    setSending(true);
    setError(null);
    const idLote = crypto.randomUUID();
    const now = new Date().toISOString();

    const allPayloadItems = items.map((i) => buildPayloadItem(i, fieldMapping));
    const totalBatches = Math.ceil(allPayloadItems.length / BATCH_SIZE);

    let allSuccess = true;
    let lastCode = 200;
    let lastError = "";

    try {
      for (let b = 0; b < totalBatches; b++) {
        setProgress({ current: b + 1, total: totalBatches });
        const chunk = allPayloadItems.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

        // Power Automate expects a simple array of objects
        const payload = chunk;

        try {
          const result = await callWebhookProxy(webhook.url, payload, user?.email || "");
          lastCode = result.status;
          if (result.status !== 200 && result.status !== 202) {
            allSuccess = false;
            lastError = `HTTP ${result.status}`;
            break;
          }
        } catch (e: any) {
          allSuccess = false;
          lastCode = 0;
          lastError = e.message;
          break;
        }
      }

      // Log
      await supabase.from("logs_envio_sharepoint" as any).insert({
        user_id: user!.id,
        usuario_email: user!.email,
        quantidade_itens: items.length,
        id_lote: idLote,
        status: allSuccess ? "sucesso" : "erro",
        response_code: lastCode,
        mensagem_erro: allSuccess ? null : lastError,
      } as any);

      // === INSERT into pre_viabilidades (independent of webhook result) ===
      try {
        const preViabPayloads = items.map((item) => ({
          user_id: user!.id,
          criado_por: user!.email || null,
          produto_nt: item.produto || null,
          vigencia: item.vigencia ? parseInt(item.vigencia, 10) || null : null,
          viabilidade: item.designacao || null,
          ticket_mensal: item.valor_a_ser_vendido ?? null,
          observacoes: item.observacoes_user || null,
          valor_minimo: item.final_value ?? null, // from pricing engine
          origem: "fibramap",
          tipo_solicitacao: item.tipo_solicitacao || null,
          nome_cliente: item.cliente || null,
          motivo_solicitacao: null,
          codigo_smark: item.codigo_smark || null,
          status: "Aberto",
          dados_precificacao: {
            produto: item.produto || "Conectividade",
            subproduto: item.produto || "NT LINK DEDICADO FULL",
            banda: item.velocidade_mbps ?? 0,
            distancia: item.distance_m ?? 0,
            blocoIp: item.bloco_ip || "",
            tecnologia: item.tecnologia || "GPON",
            tecnologiaMeioFisico: item.tecnologia_meio_fisico || "Fibra",
            rede: item.cidade || "",
            vigencia: item.vigencia ? parseInt(item.vigencia, 10) || 12 : 12,
            taxaInstalacao: item.taxa_instalacao ?? 0,
          },
        }));
        await supabase.from("pre_viabilidades" as any).insert(preViabPayloads as any);
      } catch (preViabErr) {
        console.error("Erro ao inserir pré-viabilidades:", preViabErr);
        // Non-blocking: don't affect webhook result
      }

      if (allSuccess) {
        // Separate items: DB items (valid UUID) vs ephemeral items (single search)
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const dbItems = items.filter(i => UUID_RE.test(i.id));
        const ephemeralItems = items.filter(i => !UUID_RE.test(i.id));

        // Update existing DB items
        for (const item of dbItems) {
          await supabase
            .from("ws_feasibility_items")
            .update({
              enviado_para_sharepoint: true,
              data_envio: now,
              id_lote: idLote,
              produto: item.produto || null,
              tecnologia: item.tecnologia || null,
              tecnologia_meio_fisico: item.tecnologia_meio_fisico || null,
              velocidade_mbps: item.velocidade_mbps,
              vigencia: item.vigencia || null,
              taxa_instalacao: item.taxa_instalacao,
              valor_a_ser_vendido: item.valor_a_ser_vendido,
              cnpj_cliente: item.cnpj_cliente || null,
              bloco_ip: item.bloco_ip || null,
              tipo_solicitacao: item.tipo_solicitacao || null,
              codigo_smark: item.codigo_smark || null,
              observacoes_user: item.observacoes_user || null,
            } as any)
            .eq("id", item.id);
        }

        // For ephemeral items (single search), create a batch and insert them
        if (ephemeralItems.length > 0) {
          const { data: newBatch } = await supabase
            .from("ws_batches")
            .insert({
              user_id: user!.id,
              file_name: "Busca Unitária",
              title: "Busca Unitária",
              total_items: ephemeralItems.length,
              processed_items: ephemeralItems.length,
              failed_items: 0,
              status: "completed",
              processed_at: now,
            } as any)
            .select("id")
            .single();

          if (newBatch) {
            for (let idx = 0; idx < ephemeralItems.length; idx++) {
              const item = ephemeralItems[idx];
              await supabase
                .from("ws_feasibility_items")
                .insert({
                  batch_id: newBatch.id,
                  row_number: idx + 1,
                  designacao: item.designacao || null,
                  cliente: item.cliente || null,
                  endereco_a: item.endereco || null,
                  cidade_a: item.cidade || null,
                  uf_a: item.uf || null,
                  lat_a: item.lat,
                  lng_a: item.lng,
                  is_viable: item.is_viable ?? null,
                  is_l2l: false,
                  velocidade_mbps: item.velocidade_mbps,
                  result_stage: item.stage || null,
                  result_provider: item.provider_name || null,
                  result_distance_m: item.distance_m ?? null,
                  result_value: item.final_value ?? null,
                  result_notes: item.observacoes_system || null,
                  processing_status: "viable",
                  enviado_para_sharepoint: true,
                  data_envio: now,
                  id_lote: idLote,
                  produto: item.produto || null,
                  tecnologia: item.tecnologia || null,
                  tecnologia_meio_fisico: item.tecnologia_meio_fisico || null,
                  vigencia: item.vigencia || null,
                  taxa_instalacao: item.taxa_instalacao,
                  valor_a_ser_vendido: item.valor_a_ser_vendido,
                  cnpj_cliente: item.cnpj_cliente || null,
                  bloco_ip: item.bloco_ip || null,
                  tipo_solicitacao: item.tipo_solicitacao || null,
                  codigo_smark: item.codigo_smark || null,
                  observacoes_user: item.observacoes_user || null,
                  observacoes_system: item.observacoes_system || null,
                } as any);
            }
          }
        }

        markAsSent(items.map((i) => i.id));
      }

      setProgress(null);
      setSending(false);
      if (!allSuccess) setError(lastError);
      return allSuccess;
    } catch (e: any) {
      setSending(false);
      setProgress(null);
      setError(e.message);
      return false;
    }
  };

  const testWebhook = async (): Promise<{ ok: boolean; code: number; error?: string }> => {
    if (!webhook.url) return { ok: false, code: 0, error: "URL não configurada" };

    const now = new Date().toISOString();
    const sampleItem: Record<string, any> = {};
    for (const m of fieldMapping) {
      sampleItem[m.campoJson] = m.tipo === "number" ? 0 : "TESTE";
    }
    sampleItem.dataAnalise = now;
    sampleItem.origemLista = "Teste de Conexão";

    // Send as simple array, same format as real send
    const testPayload = [sampleItem];

    try {
      const result = await callWebhookProxy(webhook.url, testPayload, user?.email || "teste@teste.com");
      return { ok: result.status === 200 || result.status === 202, code: result.status };
    } catch (e: any) {
      return { ok: false, code: 0, error: e.message };
    }
  };

  return { send, validate, testWebhook, sending, progress, error, setError, buildPayloadItem: (item: CartItem) => buildPayloadItem(item, fieldMapping) };
}
