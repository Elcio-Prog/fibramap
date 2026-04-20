import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata o número sequencial de pré-viabilidade com prefixo FM. Ex: 45 → "#FM045" */
export function fmId(numero: number | null | undefined): string {
  if (numero == null) return "#FM???";
  return `#FM${String(numero).padStart(3, "0")}`;
}
