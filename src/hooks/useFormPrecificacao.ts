import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { classifyEquipment } from "@/lib/equipment-categories";

interface RedeOption {
  identificacao: string;
}

interface BlocoIpOption {
  identificacao: string;
}

interface EquipamentoOption {
  equipamento: string;
}

interface PaisOption {
  pais: string;
}

interface VigenciaRoiOption {
  meses: string;
  roi: number | null;
}

export interface FormState {
  // Global
  produto: "Conectividade" | "Firewall" | "VOZ" | "Switch" | "Wifi" | "Backup";
  vigencia: number;
  roiVigencia: number;
  taxaInstalacao: number;
  custosMateriaisAdicionais: number;
  motivo: string;
  projetoAvaliado: boolean;
  valorOpex: number;

  // Conectividade
  subproduto: string;
  rede: string;
  redePontaB: string;
  banda: number;
  distancia: number;
  togDistancia: boolean;
  blocoIp: string;
  custoLastMile: number;
  valorLastMile: number;
  qtdFibrasDarkFiber: number;
  tecnologia: string;
  tecnologiaMeioFisico: string;

  // Firewall
  modeloFirewall: string;
  firewallSolucao: string;

  // Switch
  modeloSwitch: string;

  // Wifi
  modeloWifi: string;

  // Shared
  qtdEquipamentos: number;

  // VOZ
  equipamentoVoz1: string;
  qtdEquipamentoVoz1: number;
  equipamentoVoz2: string;
  qtdEquipamentoVoz2: number;
  equipamentoVoz3: string;
  qtdEquipamentoVoz3: number;
  qtdRamais: number;
  qtdCanais: number;
  qtdNovasLinhas: number;
  qtdPortabilidades: number;
  minFixoLocal: number;
  minFixoLDN: number;
  minMovelLocal: number;
  minMovelLDN: number;
  min0800Movel: number;
  min0800Fixo: number;
  paisInternacional: string;
  minInternacional: number;

  // Backup
  qtdBackupTB: number;
}

const defaultSpecific: Partial<FormState> = {
  subproduto: "NT LINK DEDICADO FULL",
  rede: "",
  redePontaB: "",
  banda: 0,
  distancia: 0,
  togDistancia: true,
  blocoIp: "",
  custoLastMile: 0,
  valorLastMile: 0,
  qtdFibrasDarkFiber: 0,
  tecnologia: "GPON",
  tecnologiaMeioFisico: "Fibra",
  modeloFirewall: "",
  firewallSolucao: "",
  modeloSwitch: "",
  modeloWifi: "",
  qtdEquipamentos: 1,
  equipamentoVoz1: "",
  qtdEquipamentoVoz1: 0,
  equipamentoVoz2: "",
  qtdEquipamentoVoz2: 0,
  equipamentoVoz3: "",
  qtdEquipamentoVoz3: 0,
  qtdRamais: 0,
  qtdCanais: 0,
  qtdNovasLinhas: 0,
  qtdPortabilidades: 0,
  minFixoLocal: 0,
  minFixoLDN: 0,
  minMovelLocal: 0,
  minMovelLDN: 0,
  min0800Movel: 0,
  min0800Fixo: 0,
  paisInternacional: "",
  minInternacional: 0,
  qtdBackupTB: 0,
};

const initialState: FormState = {
  produto: "Conectividade",
  vigencia: 12,
  roiVigencia: 4,
  taxaInstalacao: 0,
  custosMateriaisAdicionais: 0,
  motivo: "",
  projetoAvaliado: false,
  valorOpex: 0,
  ...defaultSpecific,
} as FormState;

export function useFormPrecificacao() {
  const [form, setForm] = useState<FormState>(initialState);
  const [redes, setRedes] = useState<RedeOption[]>([]);
  const [blocosIp, setBlocosIp] = useState<BlocoIpOption[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoOption[]>([]);
  const [paises, setPaises] = useState<PaisOption[]>([]);
  const [vigenciaRoi, setVigenciaRoi] = useState<VigenciaRoiOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    setLoadingData(true);
    Promise.all([
      supabase.from("custo_por_mega").select("identificacao"),
      supabase.from("valor_bloco_ip").select("identificacao"),
      supabase.from("equipamentos_valor").select("equipamento"),
      supabase.from("custos_voz_pais").select("pais"),
      supabase.from("vigencia_vs_roi").select("meses, roi").order("meses"),
    ]).then(([redesRes, blocosRes, eqRes, paisRes, vigRes]) => {
      setRedes(redesRes.data ?? []);
      setBlocosIp(blocosRes.data ?? []);
      setEquipamentos((eqRes.data ?? []) as EquipamentoOption[]);
      setPaises(paisRes.data ?? []);
      const vigData = (vigRes.data ?? []) as VigenciaRoiOption[];
      setVigenciaRoi(vigData);
      // Sync ROI with initial vigencia from DB data
      const initialRoi = vigData.find(v => v.meses === String(initialState.vigencia));
      if (initialRoi?.roi != null) {
        setForm(prev => ({ ...prev, roiVigencia: initialRoi.roi! }));
      }
      setLoadingData(false);
    });
  }, []);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const setProduto = useCallback((produto: FormState["produto"]) => {
    setForm(prev => ({
      ...prev,
      ...defaultSpecific,
      produto,
      // keep globals
      vigencia: prev.vigencia,
      roiVigencia: prev.roiVigencia,
      taxaInstalacao: prev.taxaInstalacao,
      custosMateriaisAdicionais: prev.custosMateriaisAdicionais,
      motivo: prev.motivo,
      projetoAvaliado: prev.projetoAvaliado,
      valorOpex: prev.valorOpex,
    } as FormState));
  }, []);

  // Derived options
  const redeOptions = redes
    .filter(r => !r.identificacao.startsWith("Custo do") && !r.identificacao.startsWith("Custo Operacional") && !r.identificacao.startsWith("NT"))
    .map(r => r.identificacao);

  const firewallModelos = equipamentos
    .filter(e => classifyEquipment(e.equipamento) === "Firewall")
    .map(e => e.equipamento);

  const firewallSolucoes = ["NT FIREWALL PLUS", "NT FIREWALL WEB", "NT FIREWALL BASIC"];

  const switchModelos = equipamentos
    .filter(e => classifyEquipment(e.equipamento) === "Switch")
    .map(e => e.equipamento);

  const wifiModelos = equipamentos
    .filter(e => classifyEquipment(e.equipamento) === "Wifi")
    .map(e => e.equipamento);

  const vozEquipamentos = equipamentos
    .filter(e => classifyEquipment(e.equipamento) === "VOZ")
    .map(e => e.equipamento);

  const paisOptions = paises.map(p => p.pais);

  const blocoIpOptions = blocosIp.map(b => b.identificacao);

  const vigenciaOptions = vigenciaRoi.map(v => v.meses);

  const getRoiForVigencia = useCallback((meses: string): number | null => {
    const match = vigenciaRoi.find(v => v.meses === meses);
    return match?.roi ?? null;
  }, [vigenciaRoi]);

  // Build payload for edge function
  const buildPayload = useCallback(() => {
    const p = form;
    const base = {
      produto: p.produto,
      vigencia: p.subproduto === "NT EVENTO" ? 1 : p.vigencia,
      roiVigencia: p.roiVigencia,
      taxaInstalacao: p.taxaInstalacao,
      custosMateriaisAdicionais: p.custosMateriaisAdicionais,
      motivo: p.motivo || undefined,
      projetoAvaliado: p.projetoAvaliado,
      valorOpex: p.valorOpex,
    };

    switch (p.produto) {
      case "Conectividade":
        return {
          ...base,
          subproduto: p.subproduto,
          rede: p.rede || undefined,
          redePontaB: p.subproduto === "NT L2L" ? (p.redePontaB || undefined) : undefined,
          banda: p.banda,
          distancia: p.distancia,
          togDistancia: p.togDistancia,
          blocoIp: p.blocoIp || undefined,
          custoLastMile: p.custoLastMile,
          valorLastMile: p.valorLastMile,
          qtdFibrasDarkFiber: p.subproduto === "NT DARK FIBER" ? p.qtdFibrasDarkFiber : undefined,
        };
      case "Firewall":
        return {
          ...base,
          modeloFirewall: p.modeloFirewall || undefined,
          firewallSolucao: p.firewallSolucao || undefined,
          qtdEquipamentos: p.qtdEquipamentos,
        };
      case "Switch":
        return { ...base, modeloSwitch: p.modeloSwitch || undefined, qtdEquipamentos: p.qtdEquipamentos };
      case "Wifi":
        return { ...base, modeloWifi: p.modeloWifi || undefined, qtdEquipamentos: p.qtdEquipamentos };
      case "VOZ":
        return {
          ...base,
          equipamentoVoz1: p.equipamentoVoz1 || undefined,
          qtdEquipamentoVoz1: p.qtdEquipamentoVoz1,
          equipamentoVoz2: p.equipamentoVoz2 || undefined,
          qtdEquipamentoVoz2: p.qtdEquipamentoVoz2,
          equipamentoVoz3: p.equipamentoVoz3 || undefined,
          qtdEquipamentoVoz3: p.qtdEquipamentoVoz3,
          qtdRamais: p.qtdRamais,
          qtdCanais: p.qtdCanais,
          qtdNovasLinhas: p.qtdNovasLinhas,
          qtdPortabilidades: p.qtdPortabilidades,
          minFixoLocal: p.minFixoLocal,
          minFixoLDN: p.minFixoLDN,
          minMovelLocal: p.minMovelLocal,
          minMovelLDN: p.minMovelLDN,
          min0800Movel: p.min0800Movel,
          min0800Fixo: p.min0800Fixo,
          paisInternacional: p.paisInternacional || undefined,
          minInternacional: p.minInternacional,
        };
      case "Backup":
        return { ...base, qtdBackupTB: p.qtdBackupTB };
      default:
        return base;
    }
  }, [form]);

  return {
    form,
    setField,
    setProduto,
    buildPayload,
    loadingData,
    getRoiForVigencia,
    options: {
      redes: redeOptions,
      blocosIp: blocoIpOptions,
      vigencias: vigenciaOptions,
      firewallModelos,
      firewallSolucoes,
      switchModelos,
      wifiModelos,
      vozEquipamentos,
      paises: paisOptions,
    },
  };
}
