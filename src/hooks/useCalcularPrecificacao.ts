import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CalcInput {
  produto: "Conectividade" | "Firewall" | "VOZ" | "Switch" | "Wifi" | "Backup";
  subproduto?: string;
  rede?: string;
  redePontaB?: string;
  banda?: number;
  distancia?: number;
  blocoIp?: string;
  custoLastMile?: number;
  valorLastMile?: number;
  qtdFibrasDarkFiber?: number;
  togDistancia?: boolean;
  projetoAvaliado?: boolean;
  motivo?: string;
  taxaInstalacao?: number;
  custosMateriaisAdicionais?: number;
  roiVigencia?: number;
  vigencia?: number;
  valorOpex?: number;
  modeloFirewall?: string;
  firewallSolucao?: string;
  qtdEquipamentos?: number;
  modeloSwitch?: string;
  modeloWifi?: string;
  equipamentoVoz1?: string;
  qtdEquipamentoVoz1?: number;
  equipamentoVoz2?: string;
  qtdEquipamentoVoz2?: number;
  equipamentoVoz3?: string;
  qtdEquipamentoVoz3?: number;
  qtdRamais?: number;
  qtdNovasLinhas?: number;
  qtdPortabilidades?: number;
  qtdCanais?: number;
  minFixoLocal?: number;
  minFixoLDN?: number;
  minMovelLocal?: number;
  minMovelLDN?: number;
  min0800Movel?: number;
  min0800Fixo?: number;
  paisInternacional?: string;
  minInternacional?: number;
  qtdBackupTB?: number;
}

interface MemoriaItem {
  label: string;
  valor: number;
}

interface CalcOutput {
  valorMinimo: number;
  valorCapex: number;
  valorOpex: number;
  mensagem?: string;
  memoriaCalculo?: MemoriaItem[];
}

export function useCalcularPrecificacao() {
  const [data, setData] = useState<CalcOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calcular = useCallback(async (input: CalcInput) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "calcular-precificacao",
        { body: input }
      );
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      setData(result as CalcOutput);
      return result as CalcOutput;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao calcular";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, calcular };
}
