import { useState } from "react";
import { usePreViabilidades, PreViabilidade } from "@/hooks/usePreViabilidades";
import { useUserRole } from "@/hooks/useUserRole";
import PreViabilidadeTable from "@/components/pre-viabilidade/PreViabilidadeTable";
import PreViabilidadeFilters from "@/components/pre-viabilidade/PreViabilidadeFilters";
import PreViabilidadeEditDrawer from "@/components/pre-viabilidade/PreViabilidadeEditDrawer";
import PreViabilidadeCreateDialog from "@/components/pre-viabilidade/PreViabilidadeCreateDialog";
import RoiGlobalReportDialog from "@/components/pre-viabilidade/RoiGlobalReportDialog";
import { Loader2, FileCheck, X, Plus, BarChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PreViabilidadePage() {
  const { data, isLoading } = usePreViabilidades();
  const { isAdmin } = useUserRole();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editItem, setEditItem] = useState<PreViabilidade | null>(null);
  const [guardaChuvaFilter, setGuardaChuvaFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Pré Viabilidade</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Todos os registros de pré viabilidade" : "Seus registros de pré viabilidade"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReportOpen(true)} className="gap-2 bg-background">
            <BarChart className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Gerar Relatório Roi Global</span>
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Criar Pré Viabilidade</span>
            <span className="sm:hidden">Criar</span>
          </Button>
        </div>
      </div>

      <PreViabilidadeFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {guardaChuvaFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-xs">
            Guarda-Chuva: {guardaChuvaFilter}
            <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 p-0" onClick={() => setGuardaChuvaFilter(null)}>
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <PreViabilidadeTable
          data={data || []}
          search={search}
          statusFilter={statusFilter}
          guardaChuvaFilter={guardaChuvaFilter}
          onGuardaChuvaClick={setGuardaChuvaFilter}
          onEdit={setEditItem}
        />
      )}

      {isAdmin && (
        <PreViabilidadeEditDrawer
          item={editItem}
          open={!!editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
        />
      )}

      <PreViabilidadeCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RoiGlobalReportDialog open={reportOpen} onOpenChange={setReportOpen} data={data || []} />
    </div>
  );
}
