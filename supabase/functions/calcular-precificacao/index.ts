import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Interfaces ──────────────────────────────────────────────────────────────

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
  marcaFirewall?: string;
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

interface CalcOutput {
  valorMinimo: number;
  valorCapex: number;
  valorOpex: number;
  mensagem?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeDivide(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function roundDown4(v: number): number {
  return Math.floor(v * 10000) / 10000;
}

function fatorBandaPadrao(banda: number): number {
  try {
    return banda * Math.max((-0.0556 * banda + 105.05) / 100, 0.5);
  } catch {
    return 1;
  }
}

function fatorBandaBGP(banda: number): number {
  try {
    if (banda <= 1000) return banda * 1.0;
    if (banda <= 40000) return banda * ((-0.00051 * banda + 100.5) / 100);
    return banda * 0.8;
  } catch {
    return 1;
  }
}

// ── DB loaders ──────────────────────────────────────────────────────────────

interface DbCosts {
  custoPorMega: Map<string, Record<string, number>>;
  taxasLink: Map<string, number>;
  valorBlocoIp: Map<string, number>;
  equipamentos: Map<string, { valor_final: number; valor: number }>;
  custosPabx: Map<string, number>;
  custoVozGeral: Map<string, number>;
  custosVozPais: Map<string, number>;
}

async function loadAllCosts(
  supabase: ReturnType<typeof createClient>
): Promise<DbCosts> {
  const [
    { data: megaRows },
    { data: taxasRows },
    { data: blocoRows },
    { data: eqRows },
    { data: pabxRows },
    { data: vozRows },
    { data: vozPaisRows },
  ] = await Promise.all([
    supabase.from("custo_por_mega").select("*"),
    supabase.from("taxas_link").select("*"),
    supabase.from("valor_bloco_ip").select("*"),
    supabase.from("equipamentos_valor").select("*"),
    supabase.from("tabela_custos_pabx").select("*"),
    supabase.from("custo_voz_geral").select("*"),
    supabase.from("custos_voz_pais").select("*"),
  ]);

  const custoPorMega = new Map<string, Record<string, number>>();
  for (const r of megaRows ?? []) {
    custoPorMega.set(r.identificacao, {
      valor_link: num(r.valor_link),
      valor_link_full: num(r.valor_link_full),
      valor_link_flex: num(r.valor_link_flex),
      valor_link_empresa: num(r.valor_link_empresa),
      valor_l2l: num(r.valor_l2l),
      valor_ptt: num(r.valor_ptt),
    });
  }

  const taxasLink = new Map<string, number>();
  for (const r of taxasRows ?? []) {
    taxasLink.set(r.identificacao, num(r.margem_lucro));
  }

  const valorBlocoIp = new Map<string, number>();
  for (const r of blocoRows ?? []) {
    valorBlocoIp.set(r.identificacao, num(r.valor));
  }

  const equipamentos = new Map<string, { valor_final: number; valor: number }>();
  for (const r of eqRows ?? []) {
    equipamentos.set(r.equipamento, {
      valor_final: num(r.valor_final),
      valor: num(r.valor),
    });
  }

  const custosPabx = new Map<string, number>();
  for (const r of pabxRows ?? []) {
    custosPabx.set(r.identificador, num(r.preco_final));
  }

  const custoVozGeral = new Map<string, number>();
  for (const r of vozRows ?? []) {
    custoVozGeral.set(r.descricao, num(r.custo_minuto));
  }

  const custosVozPais = new Map<string, number>();
  for (const r of vozPaisRows ?? []) {
    custosVozPais.set(r.pais, num(r.custo_final));
  }

  return {
    custoPorMega,
    taxasLink,
    valorBlocoIp,
    equipamentos,
    custosPabx,
    custoVozGeral,
    custosVozPais,
  };
}

// ── Calculation per product ─────────────────────────────────────────────────

function calcConectividade(input: CalcInput, db: DbCosts, regraProjetistaAtiva = false): CalcOutput {
  const {
    subproduto = "",
    rede,
    redePontaB,
    banda,
    distancia,
    blocoIp,
    togDistancia,
    projetoAvaliado,
    motivo,
    taxaInstalacao,
    custosMateriaisAdicionais,
    roiVigencia: roiVigenciaInput,
    valorOpex: valorOpexInput,
  } = input;
  let { custoLastMile, valorLastMile, vigencia: vig, qtdFibrasDarkFiber } = input;
  custoLastMile = custoLastMile ?? 0;
  valorLastMile = valorLastMile ?? 0;
  qtdFibrasDarkFiber = qtdFibrasDarkFiber ?? 0;
  let vigencia = vig ?? 1;
  const roiVigencia = roiVigenciaInput ?? 1;

  // Global costs
  const linkcustoCAC = db.taxasLink.get("Despesa de CAC") ?? 0;
  const linktaxaLink = db.taxasLink.get(subproduto) ?? 0;
  const linkcustoONU = db.equipamentos.get("DM986414Q - ONU")?.valor ?? 0;
  const pabxDespesaCAC = db.custosPabx.get("Despesa de CAC (SVA'") ?? 0;
  const custoMetroDarkFiber = db.custoPorMega.get("Custo do Metro Dark Fiber")?.valor_link ?? 0;
  const custoMetroRede = db.custoPorMega.get("Custo do Metro de rede")?.valor_link ?? 0;
  const custoBGP = db.custoPorMega.get("Custo do Mega uso de BGP")?.valor_link ?? 0;

  // ── 3.2.1 linkcustoBanda1 ──
  let linkcustoBanda1: number;
  let linkcustoBanda2 = 0;
  let linkcustoBlocoIP = blocoIp ? (db.valorBlocoIp.get(blocoIp) ?? 0) : 0;

  // Default
  if (rede) {
    linkcustoBanda1 = db.custoPorMega.get(rede)?.valor_link ?? db.custoPorMega.get("Rede Normal")?.valor_link ?? 0;
  } else {
    linkcustoBanda1 =
      db.custoPorMega.get("Custo do Mega rede Normal")?.valor_link ??
      db.custoPorMega.get("Rede Normal")?.valor_link ??
      0;
  }

  // Overrides per subproduto
  if (subproduto === "NT PTT") {
    if (rede) {
      linkcustoBanda1 = db.custoPorMega.get(rede)?.valor_ptt ?? 0;
    } else {
      linkcustoBanda1 = db.custoPorMega.get("Custo do Mega rede Normal")?.valor_ptt ?? 0;
    }
  } else if (subproduto === "NT L2L") {
    linkcustoBanda1 = db.custoPorMega.get(rede ?? "")?.valor_l2l ?? 0;
    linkcustoBanda2 = db.custoPorMega.get(redePontaB ?? "")?.valor_l2l ?? 0;
    linkcustoBlocoIP = 0;
  } else if (subproduto === "NT LINK DEDICADO FULL") {
    linkcustoBanda1 = db.custoPorMega.get(rede ?? "Rede Normal")?.valor_link_full ?? 0;
  } else if (subproduto === "NT LINK DEDICADO FLEX") {
    linkcustoBanda1 = db.custoPorMega.get(rede ?? "Rede Normal")?.valor_link_flex ?? 0;
  } else if (subproduto === "NT LINK EMPRESA") {
    linkcustoBanda1 = db.custoPorMega.get(rede ?? "Rede Normal")?.valor_link_empresa ?? 0;
  } else if (subproduto === "NT LINK IP TRANSITO") {
    const custoBandaRede = db.custoPorMega.get(rede ?? "")?.valor_link ?? 0;
    linkcustoBanda1 = custoBandaRede > custoBGP ? custoBandaRede : custoBGP;
  } else if (subproduto === "NT EVENTO") {
    vigencia = 1;
  }

  let linkcustoLancamento = 0;
  let linkFatorBanda: number;

  if (subproduto === "NT DARK FIBER") {
    linkcustoBanda1 = 0;
    linkcustoBanda2 = 0;
    linkcustoBlocoIP = 0;
    custoLastMile = 0;
    valorLastMile = 0;
    linkFatorBanda = 0;
    linkcustoLancamento = -linkcustoONU;
  } else {
    linkFatorBanda =
      subproduto === "NT LINK IP TRANSITO"
        ? fatorBandaBGP(banda ?? 0)
        : fatorBandaPadrao(banda ?? 0);
    // IfError fallback = 1
    if (!Number.isFinite(linkFatorBanda)) linkFatorBanda = 1;
  }

  if (motivo === "Mudança de endereço" || motivo === "Mudança de ponto") {
    linkcustoBanda1 = 0;
    linkcustoBanda2 = 0;
    linkcustoBlocoIP = 0;
  }

  // ── 3.2.2 CAPEX ──
  if (subproduto !== "NT DARK FIBER") {
    linkcustoLancamento = togDistancia ? custoMetroRede * (distancia ?? 0) : 0;
  }
  const valorCapex = linkcustoONU + linkcustoLancamento;

  // ── 3.2.4 custosGerais ──
  const custosGerais = Math.max(
    0,
    valorCapex - (taxaInstalacao ?? 0) + (custosMateriaisAdicionais ?? 0)
  );

  // ── 3.2.5 Dark Fiber mínimo ──
  const valorMinimoDarkFiber =
    (distancia ?? 0) * custoMetroDarkFiber * qtdFibrasDarkFiber * (1 + pabxDespesaCAC);

  let valorMinimo: number;

  if (togDistancia) {
    // ── 3.2.7 Toggle ON ──
    const podeCalcular =
      (banda ?? 0) <= 500 &&
      (distancia ?? 0) <= 2000 &&
      subproduto !== "PTP" &&
      (distancia ?? 0) > 0;

    if (regraProjetistaAtiva && !podeCalcular && !projetoAvaliado) {
      return {
        valorMinimo: 0,
        valorCapex,
        valorOpex: 0,
        mensagem: "O valor mínimo depende da distância, favor aguarde a avaliação",
      };
    }

    let pisoBase: number;
    if (!custoLastMile || custoLastMile < 1) {
      pisoBase =
        (safeDivide(custosGerais, vigencia) +
          linkcustoBlocoIP +
          (linkcustoBanda1 + linkcustoBanda2) * linkFatorBanda +
          valorLastMile) *
        (1 + linkcustoCAC) *
        (1 + linktaxaLink);
    } else {
      pisoBase = Math.max(
        safeDivide(custoLastMile, 0.33) + linkcustoBlocoIP + safeDivide(custosGerais, vigencia),
        850
      );
    }

    const piso300 =
      motivo && ["Mudança de endereço", "Mudança de ponto"].includes(motivo) ? 0 : 300;

    valorMinimo = Math.max(
      pisoBase,
      piso300,
      valorMinimoDarkFiber,
      safeDivide(valorLastMile, 0.33) + safeDivide(custosGerais, roiVigencia)
    );
  } else {
    // ── 3.2.6 Toggle OFF ──
    const metodo1 =
      (safeDivide(custosGerais, vigencia) +
        linkcustoBlocoIP +
        (linkcustoBanda1 + linkcustoBanda2) * linkFatorBanda +
        valorLastMile) *
      (1 + linkcustoCAC) *
      (1 + linktaxaLink);

    const metodo2 = safeDivide(valorCapex, roiVigencia) * qtdFibrasDarkFiber;

    const metodo3 =
      safeDivide(valorLastMile, 0.33) + safeDivide(custosGerais, roiVigencia);

    valorMinimo = Math.max(metodo1, metodo2, metodo3);
  }

  // ── 3.2.8 Isenção BGP ──
  if (subproduto === "NT LINK IP TRANSITO" && rede && rede !== "Rede Normal") {
    return {
      valorMinimo: roundDown4((valorOpexInput ?? 0)),
      valorCapex: 0,
      valorOpex: valorOpexInput ?? 0,
    };
  }

  // Final rounding + opex
  valorMinimo = roundDown4(valorMinimo) + (valorOpexInput ?? 0);

  return { valorMinimo, valorCapex, valorOpex: valorOpexInput ?? 0 };
}

function calcFirewall(input: CalcInput, db: DbCosts): CalcOutput {
  const {
    modeloFirewall = "",
    marcaFirewall = "",
    qtdEquipamentos = 0,
    vigencia = 1,
    roiVigencia = 1,
    taxaInstalacao,
    custosMateriaisAdicionais,
    valorOpex: valorOpexInput,
  } = input;

  const pabxDespesaCAC = db.custosPabx.get("Despesa de CAC (SVA'") ?? 0;
  const pabxMargemLucro = db.custosPabx.get("Margem de Lucro") ?? 0;
  const custoPorContrato =
    db.custosPabx.get("Custo Firewall Switch e Wifi por contrato") ?? 0;

  const licencaKey = `${marcaFirewall} ${modeloFirewall} ANUAL`;
  const licencaFirewall = db.equipamentos.get(licencaKey)?.valor_final ?? 0;
  const valorEquipamento = db.equipamentos.get(modeloFirewall)?.valor_final ?? 0;

  const valorCapex =
    (licencaFirewall * Math.ceil(safeDivide(vigencia, 12)) + valorEquipamento) * qtdEquipamentos;
  const custosGerais = Math.max(
    0,
    valorCapex - (taxaInstalacao ?? 0) + (custosMateriaisAdicionais ?? 0)
  );

  let valorMinimo =
    safeDivide(custosGerais, roiVigencia) +
    custoPorContrato * (1 + pabxDespesaCAC) * (1 + pabxMargemLucro);

  valorMinimo = roundDown4(valorMinimo) + (valorOpexInput ?? 0);

  return { valorMinimo, valorCapex, valorOpex: valorOpexInput ?? 0 };
}

function calcSwitch(input: CalcInput, db: DbCosts): CalcOutput {
  const {
    modeloSwitch = "",
    qtdEquipamentos = 0,
    roiVigencia = 1,
    taxaInstalacao,
    custosMateriaisAdicionais,
    valorOpex: valorOpexInput,
  } = input;

  const pabxDespesaCAC = db.custosPabx.get("Despesa de CAC (SVA'") ?? 0;
  const pabxMargemLucro = db.custosPabx.get("Margem de Lucro") ?? 0;
  const custoPorContrato =
    db.custosPabx.get("Custo Firewall Switch e Wifi por contrato") ?? 0;

  const valorEquipamento = db.equipamentos.get(modeloSwitch)?.valor_final ?? 0;
  const valorCapex = valorEquipamento * qtdEquipamentos;
  const custosGerais = Math.max(
    0,
    valorCapex - (taxaInstalacao ?? 0) + (custosMateriaisAdicionais ?? 0)
  );

  let valorMinimo =
    (safeDivide(custosGerais, roiVigencia) + custoPorContrato) *
    (1 + pabxDespesaCAC) *
    (1 + pabxMargemLucro);

  valorMinimo = roundDown4(valorMinimo) + (valorOpexInput ?? 0);

  return { valorMinimo, valorCapex, valorOpex: valorOpexInput ?? 0 };
}

function calcWifi(input: CalcInput, db: DbCosts): CalcOutput {
  const {
    modeloWifi = "",
    qtdEquipamentos = 0,
    roiVigencia = 1,
    taxaInstalacao,
    custosMateriaisAdicionais,
    valorOpex: valorOpexInput,
  } = input;

  const pabxDespesaCAC = db.custosPabx.get("Despesa de CAC (SVA'") ?? 0;
  const pabxMargemLucro = db.custosPabx.get("Margem de Lucro") ?? 0;
  const custoPorContrato =
    db.custosPabx.get("Custo Firewall Switch e Wifi por contrato") ?? 0;
  const fontePOE = db.custosPabx.get("Valor Fonte POE") ?? 0;

  const valorEquipamento = db.equipamentos.get(modeloWifi)?.valor_final ?? 0;
  const valorCapex = (valorEquipamento + fontePOE) * qtdEquipamentos;
  const custosGerais = Math.max(
    0,
    valorCapex - (taxaInstalacao ?? 0) + (custosMateriaisAdicionais ?? 0)
  );

  let valorMinimo =
    (safeDivide(custosGerais, roiVigencia) + custoPorContrato) *
    (1 + pabxDespesaCAC) *
    (1 + pabxMargemLucro);

  valorMinimo = roundDown4(valorMinimo) + (valorOpexInput ?? 0);

  return { valorMinimo, valorCapex, valorOpex: valorOpexInput ?? 0 };
}

function calcVoz(input: CalcInput, db: DbCosts): CalcOutput {
  const {
    equipamentoVoz1,
    qtdEquipamentoVoz1 = 0,
    equipamentoVoz2,
    qtdEquipamentoVoz2 = 0,
    equipamentoVoz3,
    qtdEquipamentoVoz3 = 0,
    qtdRamais = 0,
    qtdNovasLinhas = 0,
    qtdPortabilidades = 0,
    qtdCanais = 0,
    minFixoLocal = 0,
    minFixoLDN = 0,
    minMovelLocal = 0,
    minMovelLDN = 0,
    min0800Movel = 0,
    min0800Fixo = 0,
    paisInternacional,
    minInternacional = 0,
    vigencia = 1,
    roiVigencia = 1,
    taxaInstalacao,
    custosMateriaisAdicionais,
    valorOpex: valorOpexInput,
  } = input;

  const vozMargemLucro = db.custoVozGeral.get("Margem de Lucro") ?? 0;
  const vozDespesaCAC = db.custoVozGeral.get("Despesa de CAC STFC") ?? 0;
  const custoNovaLinha = db.custoVozGeral.get("Custo de uma nova linha") ?? 0;
  const custoRamais = db.custoVozGeral.get("Custo por Ramal PABX") ?? 0;
  const custoPortabilidade = db.custoVozGeral.get("Portabilidade") ?? 0;
  const custoAte30Canais = db.custoVozGeral.get("Custo Canal de 2 a 29") ?? 0;
  const custoAte50Canais = db.custoVozGeral.get("Custo Canal de 30 a 49") ?? 0;
  const custoFixoLocal = db.custoVozGeral.get("Fixo Local") ?? 0;
  const custoFixoLDN = db.custoVozGeral.get("Fixo LDN") ?? 0;
  const custoMovelLocal = db.custoVozGeral.get("Movel Local") ?? 0;
  const custoMovelLDN = db.custoVozGeral.get("Movel LDN") ?? 0;
  const custo0800Movel = db.custoVozGeral.get("Voz 0800 Móvel") ?? 0;
  const custo0800LDN = db.custoVozGeral.get("Voz 0800 Fixo") ?? 0;
  const custoOpTotal = db.custoVozGeral.get("Total unitário Custo OPERACIONAL") ?? 0;

  // Equipamentos
  const getEqVal = (name?: string): number =>
    name ? (db.equipamentos.get(name)?.valor_final ?? 0) : 0;

  const precoEq1 = safeDivide(qtdEquipamentoVoz1 * getEqVal(equipamentoVoz1), vigencia);
  const precoEq2 = safeDivide(qtdEquipamentoVoz2 * getEqVal(equipamentoVoz2), vigencia);
  const precoEq3 = safeDivide(qtdEquipamentoVoz3 * getEqVal(equipamentoVoz3), vigencia);

  const valorCapex = (precoEq1 + precoEq2 + precoEq3) * vigencia + 1;
  const custosGerais = Math.max(
    0,
    valorCapex - (taxaInstalacao ?? 0) + (custosMateriaisAdicionais ?? 0)
  );

  // Serviços
  const valorNovasLinhas = qtdNovasLinhas * custoNovaLinha;
  const valorRamais = qtdRamais * custoRamais;
  const valorPortabilidades = qtdPortabilidades * custoPortabilidade;
  const valorFixoLocalCalc = minFixoLocal * custoFixoLocal;
  const valorFixoLDNCalc = minFixoLDN * custoFixoLDN;
  const valorMovelLocalCalc = minMovelLocal * custoMovelLocal;
  const valorMovelLDNCalc = minMovelLDN * custoMovelLDN;
  const valor0800MovelCalc = min0800Movel * custo0800Movel;
  const valor0800FixoCalc = min0800Fixo * custo0800LDN;

  // Internacional
  const custoPais = paisInternacional ? (db.custosVozPais.get(paisInternacional) ?? 0) : 0;
  const valorInternacional = minInternacional * custoPais;

  // Canais
  let valorCanais: number;
  if (qtdCanais <= 2) {
    valorCanais = 0;
  } else if (qtdCanais < 30) {
    valorCanais = custoAte30Canais;
  } else if (qtdCanais < 50) {
    valorCanais = custoAte50Canais;
  } else if (qtdCanais > 50) {
    return {
      valorMinimo: 0,
      valorCapex,
      valorOpex: 0,
      mensagem: "Projeto especial. Consultar área técnica de Voz",
    };
  } else {
    valorCanais = 9_999_999_999; // qtd === 50
  }

  const somaServicos =
    valorNovasLinhas +
    valorPortabilidades +
    valorCanais +
    valorFixoLocalCalc +
    valorFixoLDNCalc +
    valorMovelLocalCalc +
    valorMovelLDNCalc +
    valor0800MovelCalc +
    valor0800FixoCalc +
    valorInternacional;

  const valorContratos = somaServicos > 0 ? custoOpTotal : 0;

  const valorContratoPabx =
    valorRamais > 0
      ? (db.custosPabx.get("Suporte por contrato (Custo de Operação)") ?? 0)
      : 0;

  let valorMinimo =
    (valorContratoPabx +
      valorContratos +
      valorNovasLinhas +
      valorPortabilidades +
      valorRamais +
      valorCanais +
      valorFixoLocalCalc +
      valorFixoLDNCalc +
      valorMovelLocalCalc +
      valorMovelLDNCalc +
      valor0800MovelCalc +
      valor0800FixoCalc +
      valorInternacional +
      safeDivide(custosGerais - 1, roiVigencia)) *
    (1 + vozDespesaCAC) *
    (1 + vozMargemLucro);

  valorMinimo = roundDown4(valorMinimo) + (valorOpexInput ?? 0);

  return { valorMinimo, valorCapex, valorOpex: valorOpexInput ?? 0 };
}

function calcBackup(input: CalcInput, db: DbCosts): CalcOutput {
  const { qtdBackupTB = 0, valorOpex: valorOpexInput } = input;

  const pabxDespesaCAC = db.custosPabx.get("Despesa de CAC (SVA'") ?? 0;
  const pabxMargemLucro = db.custosPabx.get("Margem de Lucro") ?? 0;
  const custoPorContratoBackup = db.custosPabx.get("Custo Backup por contrato") ?? 0;
  const custoPorTB = db.custosPabx.get("Custo Backup TB") ?? 0;

  let valorMinimo =
    (custoPorContratoBackup + custoPorTB) *
    qtdBackupTB *
    (1 + pabxDespesaCAC) *
    (1 + pabxMargemLucro);

  valorMinimo = roundDown4(valorMinimo) + (valorOpexInput ?? 0);

  return { valorMinimo, valorCapex: 0, valorOpex: valorOpexInput ?? 0 };
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const input: CalcInput = await req.json();

    if (
      !input.produto ||
      !["Conectividade", "Firewall", "VOZ", "Switch", "Wifi", "Backup"].includes(input.produto)
    ) {
      return new Response(JSON.stringify({ error: "Produto não suportado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = await loadAllCosts(supabase);

    // Load setup config
    let fatorAjuste = 1.0;
    let regraProjetistaAtiva = false;
    try {
      const { data: setupRow } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "setup_precificacao")
        .maybeSingle();
      if (setupRow?.valor) {
        const setup = setupRow.valor as { fator_ajuste?: number; regra_projetista_ativa?: boolean };
        fatorAjuste = (setup.fator_ajuste ?? 100) / 100;
        regraProjetistaAtiva = setup.regra_projetista_ativa ?? false;
      }
    } catch { /* use defaults */ }

    let result: CalcOutput;
    switch (input.produto) {
      case "Conectividade":
        result = calcConectividade(input, db, regraProjetistaAtiva);
        break;
      case "Firewall":
        result = calcFirewall(input, db);
        break;
      case "Switch":
        result = calcSwitch(input, db);
        break;
      case "Wifi":
        result = calcWifi(input, db);
        break;
      case "VOZ":
        result = calcVoz(input, db);
        break;
      case "Backup":
        result = calcBackup(input, db);
        break;
      default:
        result = { valorMinimo: 0, valorCapex: 0, valorOpex: 0 };
    }

    // Apply fator de ajuste
    if (fatorAjuste !== 1.0 && result.valorMinimo > 0 && !result.mensagem) {
      result.valorMinimo = roundDown4(result.valorMinimo * fatorAjuste);
    }

    // Apply regra do projetista (only for Conectividade with togDistancia)
    if (regraProjetistaAtiva && input.produto === "Conectividade" && !result.mensagem) {
      const banda = input.banda ?? 0;
      const distancia = input.distancia ?? 0;
      const subproduto = input.subproduto ?? "";
      const motivo = input.motivo ?? "";
      const projetoAvaliado = input.projetoAvaliado ?? false;

      const podeCalcular =
        banda <= 500 &&
        distancia <= 2000 &&
        subproduto !== "PTP" &&
        distancia > 0;

      const isValidador = projetoAvaliado;
      const motivoValido = motivo !== "" && motivo !== "Auto Avaliação";

      if (!(podeCalcular || isValidador || motivoValido)) {
        result.mensagem = "Favor aguarde a análise de um validador";
        result.valorMinimo = 0;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
