/** Equipment categorization for the Equipamentos tab and pricing form */

export type EquipmentCategory =
  | "Firewall"
  | "Firewall Licença"
  | "Switch"
  | "Wifi"
  | "VOZ"
  | "ONU"
  | "Outros";

export const CATEGORY_ORDER: EquipmentCategory[] = [
  "Firewall",
  "Firewall Licença",
  "Switch",
  "Wifi",
  "VOZ",
  "ONU",
  "Outros",
];

export function classifyEquipment(name: string): EquipmentCategory {
  const n = name.toUpperCase();

  // Firewall licenses (ANUAL) must come before generic firewall check
  if (/ANUAL/i.test(n)) return "Firewall Licença";

  // Firewall hardware: FN-FG-*
  if (/^FN-FG-/i.test(n)) return "Firewall";

  // Switch: FN-FS-*
  if (/^FN-FS-/i.test(n)) return "Switch";

  // Wifi / AP: FN-FAP-*, AC-*, U6-*, U7-*
  if (/^FN-FAP-|^AC[\s-]|^U[67][\s-]/i.test(n)) return "Wifi";

  // ONU
  if (/ONU/i.test(n)) return "ONU";

  // VOZ: everything else that looks like telephony
  if (/ATA\s|GRANDSTREAM|^FIP|^TIP|TELEFONE|^V\d{4}|GATEWAY|MIKROTIK/i.test(n)) return "VOZ";

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
