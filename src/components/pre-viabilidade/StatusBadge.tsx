import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null | undefined;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  "Aberto": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Aberto/Reavaliar": "bg-amber-100 text-amber-800 border-amber-200",
  "Fechado": "bg-gray-100 text-gray-600 border-gray-200",
  "Fechado - Auto Avaliação": "bg-gray-100 text-gray-600 border-gray-200",
  "Ativa": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Pendente": "bg-amber-100 text-amber-800 border-amber-200",
  "Viável": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Abaixo do Valor": "bg-red-100 text-red-800 border-red-200",
};

export default function StatusBadge({ value, className }: Props) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const style = STATUS_STYLES[value] || "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", style, className)}>
      {value}
    </Badge>
  );
}
