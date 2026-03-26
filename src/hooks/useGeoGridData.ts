import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GeoGridPasta {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  ativo: string;
}

export interface GeoGridItemRede {
  id: string;
  sigla: string;
  pasta: string;
  siglaRecipiente: string;
  siglaPoste: string;
  valor: string;
  tipo: string;
  quantidadePortasEntrada: number;
  quantidadePortas: number;
  totalPortasReservadas: number;
  portasReservadasCliente: number;
  portasAtendimentoCliente: number;
  portasOcupadas: number;
  portasLivres: number;
  latitude: number | null;
  longitude: number | null;
}

async function callGeoGridProxy(endpoint: string, params?: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("geogrid-proxy", {
    body: { endpoint, params },
  });
  if (error) throw new Error(error.message || "Erro ao chamar GeoGrid");
  if (!data?.ok) throw new Error(`GeoGrid retornou status ${data?.status}`);
  return data?.data;
}

function safeStr(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object" && val.nome) return String(val.nome);
  if (typeof val === "object" && val.sigla) return String(val.sigla);
  if (typeof val === "object" && val.descricao) return String(val.descricao);
  return JSON.stringify(val);
}

function formatValor(raw: any): string {
  if (raw == null || raw === "") return "R$0,00";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") {
    return raw.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return String(raw);
}

function parseItemRede(raw: any): GeoGridItemRede {
  return {
    id: String(raw.id ?? raw.idItemRede ?? ""),
    sigla: safeStr(raw.sigla ?? raw.nome),
    pasta: safeStr(raw.pasta ?? raw.nomePasta),
    siglaRecipiente: safeStr(raw.siglaRecipiente ?? raw.recipiente),
    siglaPoste: safeStr(raw.siglaPoste ?? raw.poste),
    valor: formatValor(raw.valor ?? raw.valorEquipamento ?? raw.value),
    tipo: safeStr(raw.tipo ?? raw.tipoEquipamento ?? raw.descricaoEquipamento),
    quantidadePortasEntrada: Number(raw.quantidadePortasEntrada ?? raw.qtdPortasEntrada ?? 0),
    quantidadePortas: Number(raw.quantidadePortas ?? raw.qtdPortas ?? 0),
    totalPortasReservadas: Number(raw.totalPortasReservadas ?? raw.qtdPortasReservadas ?? 0),
    portasReservadasCliente: Number(raw.portasReservadasCliente ?? raw.qtdPortasReservadasCliente ?? 0),
    portasAtendimentoCliente: Number(raw.portasAtendimentoCliente ?? raw.qtdPortasAtendimentoCliente ?? 0),
    portasOcupadas: Number(raw.portasOcupadas ?? raw.qtdPortasOcupadas ?? 0),
    portasLivres: Number(raw.portasLivres ?? raw.qtdPortasLivres ?? 0),
    latitude: raw.latitude ? Number(String(raw.latitude).replace(",", ".")) : null,
    longitude: raw.longitude ? Number(String(raw.longitude).replace(",", ".")) : null,
  };
}

export function useGeoGridPastas() {
  const [pastas, setPastas] = useState<GeoGridPasta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPastas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callGeoGridProxy("pastas");
      const registros = result?.registros ?? result ?? [];
      const parsed: GeoGridPasta[] = (Array.isArray(registros) ? registros : []).map((r: any) => ({
        id: String(r.id),
        nome: typeof r.nome === "string" ? r.nome : (r.nome?.nome ?? JSON.stringify(r.nome) ?? ""),
        cidade: typeof r.cidade === "string" ? r.cidade : null,
        estado: typeof r.estado === "string" ? r.estado : null,
        ativo: typeof r.ativo === "string" ? r.ativo : "S",
      }));
      setPastas(parsed.filter((p) => p.ativo === "S"));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { pastas, loading, error, fetchPastas };
}

export function useGeoGridItensRede() {
  const [items, setItems] = useState<GeoGridItemRede[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);

  const fetchItensRede = useCallback(async (params?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    setRawResponse(null);
    try {
      const result = await callGeoGridProxy("itensRede", params);
      setRawResponse(result);
      const registros = result?.registros ?? result ?? [];
      const list = Array.isArray(registros) ? registros : [];
      setItems(list.map(parseItemRede));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { items, loading, error, rawResponse, fetchItensRede };
}
