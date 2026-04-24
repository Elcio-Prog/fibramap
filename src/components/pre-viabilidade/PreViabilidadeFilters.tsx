import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  viabilidadeFilter: string;
  onViabilidadeFilterChange: (v: string) => void;
}

export default function PreViabilidadeFilters({ search, onSearchChange, statusFilter, onStatusFilterChange, viabilidadeFilter, onViabilidadeFilterChange }: Props) {
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
          <SelectItem value="Aberto">Aberto</SelectItem>
          <SelectItem value="Aberto/Reavaliar">Aberto/Reavaliar</SelectItem>
          <SelectItem value="Fechado">Fechado</SelectItem>
          <SelectItem value="Fechado - Auto Avaliação">Fechado - Auto Avaliação</SelectItem>
        </SelectContent>
      </Select>
      <Select value={viabilidadeFilter} onValueChange={onViabilidadeFilterChange}>
        <SelectTrigger className="h-9 w-[200px]">
          <SelectValue placeholder="Filtrar viabilidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas Viabilidades</SelectItem>
          <SelectItem value="Aguardando Projetista">Aguardando Projetista</SelectItem>
          <SelectItem value="Viável">Viável</SelectItem>
          <SelectItem value="Viabilizado pelo Sistema">Viabilizado pelo Sistema</SelectItem>
          <SelectItem value="Abaixo do Valor">Abaixo do Valor</SelectItem>
          <SelectItem value="Abaixo do Valor - Sistema">Abaixo do Valor - Sistema</SelectItem>
          <SelectItem value="Inviabilidade Técnica">Inviabilidade Técnica</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
