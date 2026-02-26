/**
 * Normaliza valores de velocidade para Mbps.
 * Exemplos: "100M" → 100, "1G" → 1000, "10 Gbps" → 10000, "512K" → 0.512, "100" → 100
 */
export function normalizeSpeedToMbps(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim().toUpperCase();

  // Tenta extrair número + unidade
  const match = s.match(/^([\d.,]+)\s*(GBPS|GBP|GB|G|MBPS|MBP|MB|M|KBPS|KBP|KB|K)?$/);
  if (!match) return null;

  const num = parseFloat(match[1].replace(",", "."));
  if (isNaN(num)) return null;

  const unit = match[2] || "M"; // Default = Mbps
  if (unit.startsWith("G")) return num * 1000;
  if (unit.startsWith("K")) return num / 1000;
  return num; // M ou sem unidade
}

/**
 * Detecta se é um link L2L e extrai o sufixo (-A ou -B) e o ID do par.
 * Exemplos: "DES-12345-A" → { isL2L: true, suffix: "A", pairId: "DES-12345" }
 */
export function parseL2L(designacao: string | null | undefined): {
  isL2L: boolean;
  suffix: string | null;
  pairId: string | null;
} {
  if (!designacao) return { isL2L: false, suffix: null, pairId: null };
  const s = String(designacao).trim().toUpperCase();
  const match = s.match(/^(.+)-([AB])$/);
  if (match) {
    return { isL2L: true, suffix: match[2], pairId: match[1] };
  }
  return { isL2L: false, suffix: null, pairId: null };
}

/** Letras A-W como índices (0-22) */
export const WS_COLUMN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVW".split("");
