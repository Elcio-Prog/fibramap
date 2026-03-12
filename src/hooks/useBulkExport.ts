import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart, CartItem } from "@/contexts/CartContext";
import { useConfig, FieldMappingEntry } from "@/hooks/useConfig";
import { supabase } from "@/integrations/supabase/client";

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
    "Vel.": item.velocidade_original || (item.velocidade_mbps != null ? `${item.velocidade_mbps} Mbps` : ""),
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
      return v == null || v === "" || v === 0;
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

        const payload = {
          solicitante: user!.email,
          dataEnvio: now,
          metadata: { idLote, clientSideTimestamp: now, batch: b + 1, totalBatches },
          itens: chunk,
        };

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (webhook.token) headers["Authorization"] = `Bearer ${webhook.token}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
          const resp = await fetch(webhook.url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          lastCode = resp.status;
          if (resp.status !== 200 && resp.status !== 202) {
            allSuccess = false;
            lastError = `HTTP ${resp.status}`;
            break;
          }
        } catch (e: any) {
          clearTimeout(timeout);
          allSuccess = false;
          lastCode = 0;
          lastError = e.name === "AbortError" ? "Timeout (15s)" : e.message;
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

      if (allSuccess) {
        const ids = items.map((i) => i.id);
        for (let i = 0; i < ids.length; i += 500) {
          const chunk = ids.slice(i, i + 500);
          await supabase
            .from("ws_feasibility_items")
            .update({ enviado_para_sharepoint: true, data_envio: now } as any)
            .in("id", chunk);
        }
        markAsSent(ids);
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
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (webhook.token) headers["Authorization"] = `Bearer ${webhook.token}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return { ok: resp.status === 200 || resp.status === 202, code: resp.status };
    } catch (e: any) {
      return { ok: false, code: 0, error: e.message };
    }
  };

  return { send, validate, testWebhook, sending, progress, error, setError, buildPayloadItem: (item: CartItem) => buildPayloadItem(item, fieldMapping) };
}
