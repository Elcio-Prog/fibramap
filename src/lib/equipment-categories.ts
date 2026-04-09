/** Equipment categorization for the Equipamentos tab and pricing form */

export type EquipmentCategory =
  | "Firewall"
  | "Firewall Licença"
  | "Switch"
  | "Wifi"
  | "VOZ"
  | "Outros";

export const CATEGORY_ORDER: EquipmentCategory[] = [
  "Firewall",
  "Firewall Licença",
  "Switch",
  "Wifi",
  "VOZ",
  "Outros",
];

export function classifyEquipment(name: string): EquipmentCategory {
  const n = name.toUpperCase();

  // Firewall licenses (ANUAL) or LICENÇA must come before generic firewall check
  if (/ANUAL|LICEN[ÇC]A/i.test(n)) return "Firewall Licença";

  // Firewall hardware: FN-FG-* or explicitly contains Firewall
  if (/^FN-FG-|\bFIREWALL\b/i.test(n)) return "Firewall";

  // Switch: FN-FS-* or explicitly contains Switch
  if (/^FN-FS-|\bSWITCH\b/i.test(n)) return "Switch";

  // Wifi / AP: FN-FAP-*, AC-*, U6-*, U7-*, or explicitly contains Wifi/Wireless
  if (/^FN-FAP-|^AC[\s-]|^U[67][\s-]|\bWIFI\b|\bWIRELESS\b|\bAP\b/i.test(n)) return "Wifi";

  // VOZ: everything that looks like telephony + ONU
  if (/VOZ|^ATA\s|GRANDSTREAM|^FIP|^TIP|TELEFONE|^V\d{4}|GATEWAY|MIKROTIK|ONU/i.test(n)) return "VOZ";

  return "Outros";
}

export function groupByCategory<T extends { equipamento: string }>(
  items: T[]
): { category: EquipmentCategory; items: T[] }[] {
  const map = new Map<EquipmentCategory, T[]>();
  for (const item of items) {
    const cat = classifyEquipment(item.equipamento);
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  return CATEGORY_ORDER
    .filter(cat => map.has(cat))
    .map(cat => ({ category: cat, items: map.get(cat)! }));
}
