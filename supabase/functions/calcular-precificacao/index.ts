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
  tecnologia?: string;
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
  /** Valor que o vendedor quer ofertar ao cliente (mensalidade). Usado para calcular ROI_Final e decidir aprovação. */
  ticketMensal?: number;
}

interface MemoriaItem {
  label: string;
  valor: number;
  isHeader?: boolean;
  isSubItem?: boolean;
}

interface CalcOutput {
  valorMinimo: number;
  valorCapex: number;
  valorOpex: number;
  mensagem?: string;
  memoriaCalculo?: MemoriaItem[];
  /** ROI calculado: Despesas_Totais / Mensalidade_Mínima (após CAC e Margem). */
  roiTarget?: number;
  /** ROI da tabela vigencia_vs_roi (mesmo usado no Método 2). */
  roiSistema?: number;
  /** ROI escolhido pela regra: min(ROI_Target, ROI_Sistema). */
  roiEscolhido?: number;
  /** ROI calculado a partir do valor que o vendedor quer ofertar: Despesas_Totais / ticketMensal. */
  roiFinal?: number;
  /** true se ROI_Final ≤ ROI_Escolhido (ticket cobre as despesas dentro do prazo de retorno aceitável). */
  aprovado?: boolean;
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

/**
 * Indicadores de ROI / decisão de aprovação.
 * Aplicado uniformemente a todos os produtos.
 *
 * Regras (definidas pelo negócio):
 *  - capex             = CAPEX puro (lançamento + equipamentos)
 *  - despesasTotais    = CAPEX + custos operacionais (banda, IP, last mile, taxa instalação LM, contratos, etc.)
 *  - cacPct, margemPct = percentuais (ex.: 0.12, 0.20) já carregados do BD
 *  - roiSistema        = ROI configurado para a vigência (tabela vigencia_vs_roi)
 *  - mensalidadeBase   = capex / roiSistema
 *  - mensalidadeMinima = mensalidadeBase × (1 + cacPct) × (1 + margemPct)
 *  - roiTarget         = despesasTotais / mensalidadeMinima
 *  - roiEscolhido      = ROI_Target < ROI_Sistema → ROI_Target ; senão → ROI_Sistema  (regra 4)
 *  - ticketMensal      = valor que o vendedor quer ofertar
 *  - roiFinal          = despesasTotais / ticketMensal   (somente se ticket > 0)
 *  - aprovado          = roiFinal ≤ roiEscolhido
 */
function computeRoiIndicators(args: {
  capex: number;
  despesasTotais: number;
  roiSistema: number;
  cacPct: number;
  margemPct: number;
  ticketMensal?: number;
}): {
  roiTarget: number;
  roiSistema: number;
  roiEscolhido: number;
  roiFinal: number;
  aprovado: boolean;
  mensalidadeBase: number;
  mensalidadeMinima: number;
} {
  const capex = args.capex || 0;
  const despesasTotais = args.despesasTotais || 0;
  const roiSistema = args.roiSistema || 0;
  const cacPct = args.cacPct || 0;
  const margemPct = args.margemPct || 0;
  const ticketMensal = args.ticketMensal ?? 0;

  const mensalidadeBase = roiSistema > 0 ? capex / roiSistema : 0;
  const mensalidadeMinima = mensalidadeBase * (1 + cacPct) * (1 + margemPct);
  const roiTarget = mensalidadeMinima > 0 ? despesasTotais / mensalidadeMinima : 0;

  // Regra 4: se ROI_Target < ROI_Sistema → usar ROI_Target, senão manter ROI_Sistema.
  const roiEscolhido = roiTarget > 0 && roiTarget < roiSistema ? roiTarget : roiSistema;

  const roiFinal = ticketMensal > 0 ? despesasTotais / ticketMensal : 0;
  // Aprovado: o prazo de retorno calculado a partir do ticket ofertado
  // não pode exceder o prazo de retorno aceitável (roiEscolhido).
  const aprovado = ticketMensal > 0 && roiEscolhido > 0 && roiFinal <= roiEscolhido;

  return {
    roiTarget: Math.round(roiTarget * 100) / 100,
    roiSistema,
    roiEscolhido: Math.round(roiEscolhido * 100) / 100,
    roiFinal: Math.round(roiFinal * 100) / 100,
    aprovado,
    mensalidadeBase,
    mensalidadeMinima,
  };
}

function pushRoiMemoria(
  memoria: MemoriaItem[],
  ind: ReturnType<typeof computeRoiIndicators>,
  ticketMensal?: number
) {
  memoria.push({ label: "Indicadores de ROI / Aprovação", valor: 0, isHeader: true });
  memoria.push({ label: "Mensalidade Mínima (CAPEX/ROI × CAC × Margem)", valor: ind.mensalidadeMinima, isSubItem: true });
  memoria.push({ label: "ROI Target (Despesas/Mens.Mínima)", valor: ind.roiTarget, isSubItem: true });
  memoria.push({ label: "ROI Sistema (vigência)", valor: ind.roiSistema, isSubItem: true });
  memoria.push({ label: "ROI Escolhido (regra 4)", valor: ind.roiEscolhido, isSubItem: true });
  if (ticketMensal && ticketMensal > 0) {
    memoria.push({ label: "Ticket Ofertado (vendedor)", valor: ticketMensal, isSubItem: true });
    memoria.push({ label: "ROI Final (Despesas/Ticket)", valor: ind.roiFinal, isSubItem: true });
    memoria.push({
      label: ind.aprovado ? "Status: APROVADO" : "Status: REPROVADO (ticket abaixo do mínimo)",
      valor: ind.aprovado ? 1 : 0,
      isSubItem: true,
    });
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
  supabase: any
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

function calcConectividade(input: CalcInput, db: DbCosts, setup: { capex_last_mile: number, regra_projetista_ativa: boolean }): CalcOutput {
  const regraProjetistaAtiva = setup.regra_projetista_ativa;
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
  
  const baseCapex = input.tecnologia === "LAST MILE" 
    ? setup.capex_last_mile 
    : linkcustoONU;

  const valorCapex = baseCapex + linkcustoLancamento;

  // ── 3.2.4 custosGerais ──
  const custosGerais = Math.max(
    0,
    valorCapex - (taxaInstalacao ?? 0) + (custosMateriaisAdicionais ?? 0)
  );

  // ── 3.2.5 Dark Fiber mínimo ──
  const valorMinimoDarkFiber =
    (distancia ?? 0) * custoMetroDarkFiber * qtdFibrasDarkFiber * (1 + linkcustoCAC);

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
        mensagem: "Favor aguarde a análise de um validador",
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
        safeDivide(valorLastMile, 0.33) + safeDivide(custosGerais, vigencia),
        850
      );
    }

    const piso300 =
      motivo && ["Mudança de endereço", "Mudança de ponto"].includes(motivo) ? 0 : 300;

    valorMinimo = Math.max(
      pisoBase,
      piso300,
      valorMinimoDarkFiber,
      safeDivide(valorLastMile, 0.33) + safeDivide(custosGerais, vigencia)
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
      safeDivide(valorLastMile, 0.33) + safeDivide(custosGerais, vigencia);

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

  // Build memoria de calculo (only non-zero items)
  const memoria: MemoriaItem[] = [];
  const addMem = (label: string, valor: number) => { if (valor !== 0) memoria.push({ label, valor }); };
  addMem("Custo Banda (Ponta A)", linkcustoBanda1);
  if (subproduto === "NT L2L") addMem("Custo Banda (Ponta B)", linkcustoBanda2);
  addMem("Fator Banda", linkFatorBanda);
  addMem("Custo ONU", linkcustoONU);
  addMem("Custo Metro Rede", custoMetroRede);
  addMem("Custo Lançamento", linkcustoLancamento);
  addMem("Bloco IP", linkcustoBlocoIP);
  addMem("Base CAPEX", baseCapex);
  addMem("CAPEX Total", valorCapex);
  addMem("Custos Gerais", custosGerais);
  addMem("Valor Last Mile", valorLastMile ?? 0);
  addMem("Custo Last Mile", custoLastMile ?? 0);
  if (subproduto === "NT DARK FIBER") {
    addMem("Custo Metro Dark Fiber", custoMetroDarkFiber);
    addMem("Qtd Fibras", qtdFibrasDarkFiber ?? 0);
    addMem("Valor Mínimo Dark Fiber", valorMinimoDarkFiber);
  }
  addMem("Taxa Instalação", taxaInstalacao ?? 0);
  addMem("Custos Materiais Adicionais", custosMateriaisAdicionais ?? 0);
  addMem("Vigência (meses)", vigencia);
  addMem("ROI Vigência", roiVigencia);

  // ─── Custos Operacionais Totais + Margem Alvo (em R$) ───
  // Exibição: aplica %CAC e %Margem sobre o Valor Mínimo final (já consolidado).
  // CAC(R$) = ValorMin * %CAC ; Margem(R$) = (ValorMin + CAC) * %Margem
  const valorBaseExibicao = valorMinimo - (valorOpexInput ?? 0);
  const despesaCacReais = valorBaseExibicao * linkcustoCAC;
  const margemLucroReais = (valorBaseExibicao + despesaCacReais) * linktaxaLink;
  const custoOperacionalTotalMargem = despesaCacReais + margemLucroReais;
  if (custoOperacionalTotalMargem !== 0) {
    memoria.push({ label: "Custos Operacionais Totais + Margem Alvo", valor: custoOperacionalTotalMargem, isHeader: true });
    memoria.push({ label: "Despesa CAC (R$)", valor: despesaCacReais, isSubItem: true });
    memoria.push({ label: `Margem de Lucro (${subproduto}) (R$)`, valor: margemLucroReais, isSubItem: true });
  }

  // ─── Indicadores ROI / Aprovação ───
  // Despesas_Totais para Conectividade = CAPEX + custos operacionais que oneram o projeto.
  // Custos operacionais mensais → multiplicamos pela vigência para colocar na mesma base do CAPEX.
  const despesasOperacionaisMensais =
    linkcustoBlocoIP +
    (linkcustoBanda1 + linkcustoBanda2) * linkFatorBanda +
    (valorLastMile ?? 0);
  const despesasTotais =
    valorCapex +
    despesasOperacionaisMensais * vigencia +
    (custoLastMile ?? 0) +
    (custosMateriaisAdicionais ?? 0);
  const roiInd = computeRoiIndicators({
    capex: valorCapex,
    despesasTotais,
    roiSistema: roiVigencia,
    cacPct: linkcustoCAC,
    margemPct: linktaxaLink,
    ticketMensal: input.ticketMensal,
  });
  pushRoiMemoria(memoria, roiInd, input.ticketMensal);

  addMem("Valor OPEX", valorOpexInput ?? 0);
  addMem("Valor Mínimo", valorMinimo);

  return {
    valorMinimo,
    valorCapex,
    valorOpex: valorOpexInput ?? 0,
    memoriaCalculo: memoria,
    roiTarget: roiInd.roiTarget,
    roiSistema: roiInd.roiSistema,
    roiEscolhido: roiInd.roiEscolhido,
    roiFinal: roiInd.roiFinal,
    aprovado: roiInd.aprovado,
  };
}

function calcFirewall(input: CalcInput, db: DbCosts): CalcOutput {
  const {
    modeloFirewall = "",
    firewallSolucao = "",
    qtdEquipamentos = 0,
    vigencia = 1,
    roiVigencia = 1,
    taxaInstalacao,
    custosMateriaisAdicionais,
    valorOpex: valorOpexInput,
  } = input;

  const pabxDespesaCAC = db.custosPabx.get("Despesa de CAC (SVA)") ?? 0;
  const pabxMargemLucro = (db.custosPabx.get("Margem de Lucro") ?? 0) / 100;
  const custoPorContrato =
    db.custosPabx.get("Custo Firewall Switch e Wifi por contrato") ?? 0;

  const valorEquipamento = db.equipamentos.get(modeloFirewall)?.valor_final ?? 0;

  // Robust license matching — try exact keys first, then fuzzy search
  const cleanModel = modeloFirewall.replace(/^Firewall\s*-\s*/i, "").trim();
  const keysToTry = [
    `${firewallSolucao} ${cleanModel} ANUAL`,
    `Licença - ${firewallSolucao} ${cleanModel}`,
    `Licença - ${firewallSolucao} ${cleanModel} ANUAL`,
    `${firewallSolucao} ${modeloFirewall} ANUAL`,
    `Licença - ${firewallSolucao} ${modeloFirewall}`,
    `${firewallSolucao} ${modeloFirewall}`
  ];

  let licencaFirewall = 0;
  for (const k of keysToTry) {
    const val = db.equipamentos.get(k)?.valor_final;
    if (val != null && val > 0) {
      licencaFirewall = val;
      break;
    }
  }

  // Fuzzy fallback: search all equipment keys for a license containing both solution + model
  if (licencaFirewall === 0 && firewallSolucao && cleanModel) {
    const solUpper = firewallSolucao.toUpperCase();
    const modUpper = cleanModel.toUpperCase();
    for (const [key, eq] of db.equipamentos.entries()) {
      const kUp = key.toUpperCase();
      if (
        (kUp.includes("LICEN") || kUp.includes("ANUAL")) &&
        kUp.includes(solUpper) &&
        kUp.includes(modUpper) &&
        eq.valor_final != null &&
        eq.valor_final > 0
      ) {
        licencaFirewall = eq.valor_final;
        break;
      }
    }
  }

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

  const memoria: MemoriaItem[] = [];
  const addMem = (label: string, valor: number) => { if (valor !== 0) memoria.push({ label, valor }); };
  addMem("Valor Equipamento", valorEquipamento);
  addMem("Licença Firewall", licencaFirewall);
  addMem("Ciclos de Licença", Math.ceil(safeDivide(vigencia, 12)));
  addMem("Qtd Equipamentos", qtdEquipamentos);
  addMem("CAPEX Total", valorCapex);
  addMem("Taxa Instalação", taxaInstalacao ?? 0);
  addMem("Custos Materiais Adicionais", custosMateriaisAdicionais ?? 0);
  addMem("Custos Gerais", custosGerais);
  addMem("ROI Vigência", roiVigencia);

  // ─── Custos Operacionais Totais + Margem Alvo (em R$) ───
  // Exibição: %CAC e %Margem aplicados sobre o Valor Mínimo final.
  const fwBaseExib = valorMinimo - (valorOpexInput ?? 0);
  const fwCacReais = fwBaseExib * pabxDespesaCAC;
  const fwMargemReais = (fwBaseExib + fwCacReais) * pabxMargemLucro;
  const fwTotalOpMargem = fwCacReais + fwMargemReais;
  if (fwTotalOpMargem !== 0) {
    memoria.push({ label: "Custos Operacionais Totais + Margem Alvo", valor: fwTotalOpMargem, isHeader: true });
    memoria.push({ label: "Despesa CAC SVA (R$)", valor: fwCacReais, isSubItem: true });
    memoria.push({ label: "Margem de Lucro (R$)", valor: fwMargemReais, isSubItem: true });
  }

  // ─── Indicadores ROI / Aprovação (Firewall) ───
  // Despesas_Totais = CAPEX + custos operacionais (custo por contrato × vigência)
  const despesasTotaisFw =
    valorCapex + custoPorContrato * vigencia + (custosMateriaisAdicionais ?? 0);
  const fwRoiInd = computeRoiIndicators({
    capex: valorCapex,
    despesasTotais: despesasTotaisFw,
    roiSistema: roiVigencia,
    cacPct: pabxDespesaCAC,
    margemPct: pabxMargemLucro,
    ticketMensal: input.ticketMensal,
  });
  pushRoiMemoria(memoria, fwRoiInd, input.ticketMensal);

  addMem("Valor OPEX", valorOpexInput ?? 0);
  addMem("Valor Mínimo", valorMinimo);

  return {
    valorMinimo,
    valorCapex,
    valorOpex: valorOpexInput ?? 0,
    memoriaCalculo: memoria,
    roiTarget: fwRoiInd.roiTarget,
    roiSistema: fwRoiInd.roiSistema,
    roiEscolhido: fwRoiInd.roiEscolhido,
    roiFinal: fwRoiInd.roiFinal,
    aprovado: fwRoiInd.aprovado,
  };
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

  const pabxDespesaCAC = db.custosPabx.get("Despesa de CAC (SVA)") ?? 0;
  const pabxMargemLucro = (db.custosPabx.get("Margem de Lucro") ?? 0) / 100;
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

  const memoriaS: MemoriaItem[] = [];
  const addMemS = (label: string, valor: number) => { if (valor !== 0) memoriaS.push({ label, valor }); };
  addMemS("Valor Equipamento", valorEquipamento);
  addMemS("Qtd Equipamentos", qtdEquipamentos);
  addMemS("CAPEX Total", valorCapex);
  addMemS("Taxa Instalação", taxaInstalacao ?? 0);
  addMemS("Custos Materiais Adicionais", custosMateriaisAdicionais ?? 0);
  addMemS("Custos Gerais", custosGerais);
  addMemS("ROI Vigência", roiVigencia);

  // ─── Custos Operacionais Totais + Margem Alvo (em R$) ───
  // Exibição: %CAC e %Margem aplicados sobre o Valor Mínimo final.
  const swBaseExib = valorMinimo - (valorOpexInput ?? 0);
  const swCacReais = swBaseExib * pabxDespesaCAC;
  const swMargemReais = (swBaseExib + swCacReais) * pabxMargemLucro;
  const swTotalOpMargem = swCacReais + swMargemReais;
  if (swTotalOpMargem !== 0) {
    memoriaS.push({ label: "Custos Operacionais Totais + Margem Alvo", valor: swTotalOpMargem, isHeader: true });
    memoriaS.push({ label: "Despesa CAC SVA (R$)", valor: swCacReais, isSubItem: true });
    memoriaS.push({ label: "Margem de Lucro (R$)", valor: swMargemReais, isSubItem: true });
  }

  // ─── Indicadores ROI / Aprovação (Switch) ───
  const despesasTotaisSw =
    valorCapex + custoPorContrato * roiVigencia + (custosMateriaisAdicionais ?? 0);
  const swRoiInd = computeRoiIndicators({
    capex: valorCapex,
    despesasTotais: despesasTotaisSw,
    roiSistema: roiVigencia,
    cacPct: pabxDespesaCAC,
    margemPct: pabxMargemLucro,
    ticketMensal: input.ticketMensal,
  });
  pushRoiMemoria(memoriaS, swRoiInd, input.ticketMensal);

  addMemS("Valor OPEX", valorOpexInput ?? 0);
  addMemS("Valor Mínimo", valorMinimo);

  return {
    valorMinimo,
    valorCapex,
    valorOpex: valorOpexInput ?? 0,
    memoriaCalculo: memoriaS,
    roiTarget: swRoiInd.roiTarget,
    roiSistema: swRoiInd.roiSistema,
    roiEscolhido: swRoiInd.roiEscolhido,
    roiFinal: swRoiInd.roiFinal,
    aprovado: swRoiInd.aprovado,
  };
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

  const pabxDespesaCAC = db.custosPabx.get("Despesa de CAC (SVA)") ?? 0;
  const pabxMargemLucro = (db.custosPabx.get("Margem de Lucro") ?? 0) / 100;
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

  const memoriaW: MemoriaItem[] = [];
  const addMemW = (label: string, valor: number) => { if (valor !== 0) memoriaW.push({ label, valor }); };
  addMemW("Valor Equipamento", valorEquipamento);
  addMemW("Fonte POE", fontePOE);
  addMemW("Qtd Equipamentos", qtdEquipamentos);
  addMemW("CAPEX Total", valorCapex);
  addMemW("Taxa Instalação", taxaInstalacao ?? 0);
  addMemW("Custos Materiais Adicionais", custosMateriaisAdicionais ?? 0);
  addMemW("Custos Gerais", custosGerais);
  addMemW("ROI Vigência", roiVigencia);

  // ─── Custos Operacionais Totais + Margem Alvo (em R$) ───
  // Exibição: %CAC e %Margem aplicados sobre o Valor Mínimo final.
  const wfBaseExib = valorMinimo - (valorOpexInput ?? 0);
  const wfCacReais = wfBaseExib * pabxDespesaCAC;
  const wfMargemReais = (wfBaseExib + wfCacReais) * pabxMargemLucro;
  const wfTotalOpMargem = wfCacReais + wfMargemReais;
  if (wfTotalOpMargem !== 0) {
    memoriaW.push({ label: "Custos Operacionais Totais + Margem Alvo", valor: wfTotalOpMargem, isHeader: true });
    memoriaW.push({ label: "Despesa CAC SVA (R$)", valor: wfCacReais, isSubItem: true });
    memoriaW.push({ label: "Margem de Lucro (R$)", valor: wfMargemReais, isSubItem: true });
  }

  addMemW("Valor OPEX", valorOpexInput ?? 0);
  addMemW("Valor Mínimo", valorMinimo);

  return { valorMinimo, valorCapex, valorOpex: valorOpexInput ?? 0, memoriaCalculo: memoriaW };
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
  const custo0800Movel = db.custoVozGeral.get("Voz 0800 Movel") ?? 0;
  const custo0800LDN = db.custoVozGeral.get("Voz 0800 Fixo") ?? 0;
  const custoOpTotal = db.custoVozGeral.get("Total unitario Custo OPERACIONAL") ?? 0;

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

  const memoriaV: MemoriaItem[] = [];
  const addMemV = (label: string, valor: number) => { if (valor !== 0) memoriaV.push({ label, valor }); };
  addMemV("Equipamento 1", precoEq1 * vigencia);
  addMemV("Equipamento 2", precoEq2 * vigencia);
  addMemV("Equipamento 3", precoEq3 * vigencia);
  addMemV("CAPEX Total", valorCapex);
  addMemV("Taxa Instalação", taxaInstalacao ?? 0);
  addMemV("Custos Materiais Adicionais", custosMateriaisAdicionais ?? 0);
  addMemV("Custos Gerais", custosGerais);
  addMemV("Vigência (meses)", vigencia);
  addMemV("ROI Vigência", roiVigencia);
  addMemV("Novas Linhas", valorNovasLinhas);
  addMemV("Ramais", valorRamais);
  addMemV("Portabilidades", valorPortabilidades);
  addMemV("Canais", valorCanais);
  addMemV("Fixo Local", valorFixoLocalCalc);
  addMemV("Fixo LDN", valorFixoLDNCalc);
  addMemV("Móvel Local", valorMovelLocalCalc);
  addMemV("Móvel LDN", valorMovelLDNCalc);
  addMemV("0800 Móvel", valor0800MovelCalc);
  addMemV("0800 Fixo", valor0800FixoCalc);
  addMemV("Internacional", valorInternacional);

  // ─── Custos Operacionais Totais + Margem Alvo (em R$) ───
  // Exibição: %CAC e %Margem aplicados sobre o Valor Mínimo final.
  const vozBaseExib = valorMinimo - (valorOpexInput ?? 0);
  const vozCacReais = vozBaseExib * vozDespesaCAC;
  const vozMargemReais = (vozBaseExib + vozCacReais) * vozMargemLucro;
  const vozTotalOpMargem = vozCacReais + vozMargemReais;
  if (vozTotalOpMargem !== 0) {
    memoriaV.push({ label: "Custos Operacionais Totais + Margem Alvo", valor: vozTotalOpMargem, isHeader: true });
    memoriaV.push({ label: "Despesa CAC STFC (R$)", valor: vozCacReais, isSubItem: true });
    memoriaV.push({ label: "Margem de Lucro (R$)", valor: vozMargemReais, isSubItem: true });
  }

  addMemV("Valor OPEX", valorOpexInput ?? 0);
  addMemV("Valor Mínimo", valorMinimo);

  return { valorMinimo, valorCapex, valorOpex: valorOpexInput ?? 0, memoriaCalculo: memoriaV };
}

function calcBackup(input: CalcInput, db: DbCosts): CalcOutput {
  const { qtdBackupTB = 0, valorOpex: valorOpexInput } = input;

  const pabxDespesaCAC = db.custosPabx.get("Despesa de CAC (SVA)") ?? 0;
  const pabxMargemLucro = (db.custosPabx.get("Margem de Lucro") ?? 0) / 100;
  const custoPorContratoBackup = db.custosPabx.get("Custo Backup por contrato") ?? 0;
  const custoPorTB = db.custosPabx.get("Custo Backup TB") ?? 0;

  let valorMinimo =
    (custoPorContratoBackup + custoPorTB) *
    qtdBackupTB *
    (1 + pabxDespesaCAC) *
    (1 + pabxMargemLucro);

  valorMinimo = roundDown4(valorMinimo) + (valorOpexInput ?? 0);

  const memoria: MemoriaItem[] = [];
  const addMem = (label: string, valor: number) => { if (valor !== 0) memoria.push({ label, valor }); };
  addMem("Qtd TB", qtdBackupTB);
  addMem("Custo por Contrato Backup", custoPorContratoBackup);
  addMem("Custo por TB", custoPorTB);

  // ─── Custos Operacionais Totais + Margem Alvo (em R$) ───
  // Exibição: %CAC e %Margem aplicados sobre o Valor Mínimo final.
  const bkBaseExib = valorMinimo - (valorOpexInput ?? 0);
  const bkCacReais = bkBaseExib * pabxDespesaCAC;
  const bkMargemReais = (bkBaseExib + bkCacReais) * pabxMargemLucro;
  const bkTotalOpMargem = bkCacReais + bkMargemReais;
  if (bkTotalOpMargem !== 0) {
    memoria.push({ label: "Custos Operacionais Totais + Margem Alvo", valor: bkTotalOpMargem, isHeader: true });
    memoria.push({ label: "Despesa CAC SVA (R$)", valor: bkCacReais, isSubItem: true });
    memoria.push({ label: "Margem de Lucro (R$)", valor: bkMargemReais, isSubItem: true });
  }

  addMem("Valor OPEX", valorOpexInput ?? 0);
  addMem("Valor Mínimo", valorMinimo);

  return { valorMinimo, valorCapex: 0, valorOpex: valorOpexInput ?? 0, memoriaCalculo: memoria };
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
    let setupConfig = { capex_last_mile: 750, regra_projetista_ativa: false };
    try {
      const { data: setupRow } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "setup_precificacao")
        .maybeSingle();
      if (setupRow?.valor) {
        const setup = setupRow.valor as { fator_ajuste?: number; capex_last_mile?: number; regra_projetista_ativa?: boolean };
        fatorAjuste = (setup.fator_ajuste ?? 100) / 100;
        setupConfig.capex_last_mile = setup.capex_last_mile ?? 750;
        setupConfig.regra_projetista_ativa = setup.regra_projetista_ativa ?? false;
      }
    } catch { /* use defaults */ }

    let result: CalcOutput;
    switch (input.produto) {
      case "Conectividade":
        result = calcConectividade(input, db, setupConfig);
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
    if (setupConfig.regra_projetista_ativa && input.produto === "Conectividade" && !result.mensagem) {
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
