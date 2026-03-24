import { useState } from "react";
import { usePreViabilidades, PreViabilidade } from "@/hooks/usePreViabilidades";
import { useUserRole } from "@/hooks/useUserRole";
import PreViabilidadeTable from "@/components/pre-viabilidade/PreViabilidadeTable";
import PreViabilidadeFilters from "@/components/pre-viabilidade/PreViabilidadeFilters";
import PreViabilidadeEditDrawer from "@/components/pre-viabilidade/PreViabilidadeEditDrawer";
import { Loader2, FileCheck } from "lucide-react";

export default function PreViabilidadePage() {
  const { data, isLoading } = usePreViabilidades();
  const { isAdmin } = useUserRole();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editItem, setEditItem] = useState<PreViabilidade | null>(null);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <FileCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Pré Viabilidade</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Todos os registros de pré viabilidade" : "Seus registros de pré viabilidade"}
          </p>
        </div>
      </div>

      <PreViabilidadeFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <PreViabilidadeTable
          data={data || []}
          search={search}
          statusFilter={statusFilter}
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
    </div>
  );
}
