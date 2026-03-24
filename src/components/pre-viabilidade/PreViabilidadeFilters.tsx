import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
}

export default function PreViabilidadeFilters({ search, onSearchChange, statusFilter, onStatusFilterChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 h-9"
          placeholder="Buscar por cliente, viabilidade ou ID..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder="Filtrar status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="Ativa">Ativa</SelectItem>
          <SelectItem value="Fechado">Fechado</SelectItem>
          <SelectItem value="Pendente">Pendente</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
