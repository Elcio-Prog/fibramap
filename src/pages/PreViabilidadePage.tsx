import { useState } from "react";
import { usePreViabilidades, PreViabilidade } from "@/hooks/usePreViabilidades";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PreViabilidadeTable from "@/components/pre-viabilidade/PreViabilidadeTable";
import PreViabilidadeFilters from "@/components/pre-viabilidade/PreViabilidadeFilters";
import PreViabilidadeEditDrawer from "@/components/pre-viabilidade/PreViabilidadeEditDrawer";
import PreViabilidadeCreateDialog from "@/components/pre-viabilidade/PreViabilidadeCreateDialog";
import RoiGlobalReportDialog from "@/components/pre-viabilidade/RoiGlobalReportDialog";
import AprovacoesTab from "@/components/pre-viabilidade/AprovacoesTab";
import { Loader2, FileCheck, X, Plus, BarChart, Inbox, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function PreViabilidadePage() {
  const { data, isLoading, isFetching } = usePreViabilidades();
  const { isAdmin, isImplantacao } = useUserRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editItem, setEditItem] = useState<PreViabilidade | null>(null);
  const [guardaChuvaFilter, setGuardaChuvaFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [tab, setTab] = useState("registros");

  const handleReload = () => {
    qc.invalidateQueries({ queryKey: ["pre-viabilidades"] });
    qc.invalidateQueries({ queryKey: ["aprovacoes-pendentes-count"] });
  };

  // Pending approvals count badge
  const { data: pendingCount } = useQuery({
    queryKey: ["aprovacoes-pendentes-count", user?.email, isAdmin],
    queryFn: async () => {
      let q = supabase
        .from("aprovacao_tokens")
        .select("id", { count: "exact", head: true })
        .is("acao_realizada", null);
      if (!isAdmin) q = q.eq("responsavel_email", user?.email || "__none__");
      const { count, error } = await q;
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Pré Viabilidade</h1>
            <p className="text-sm text-muted-foreground">
              {(isAdmin || isImplantacao) ? "Todos os registros de pré viabilidade" : "Seus registros de pré viabilidade"}
            </p>
          </div>
        </div>
        {tab === "registros" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReload}
              disabled={isFetching}
              className="gap-2 bg-background"
              title="Recarregar"
            >
              <RefreshCw className={`h-4 w-4 text-primary ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Recarregar</span>
            </Button>
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
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="registros" className="gap-2">
            <FileCheck className="h-4 w-4" />
            Registros
          </TabsTrigger>
          <TabsTrigger value="aprovacoes" className="gap-2">
            <Inbox className="h-4 w-4" />
            Aprovações
            {pendingCount && pendingCount > 0 ? (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                {pendingCount}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registros" className="space-y-4 mt-4">
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
        </TabsContent>

        <TabsContent value="aprovacoes" className="mt-4">
          <AprovacoesTab />
        </TabsContent>
      </Tabs>

      <PreViabilidadeEditDrawer
        item={editItem}
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        readOnly={!(isAdmin || isImplantacao)}
      />

      <PreViabilidadeCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RoiGlobalReportDialog open={reportOpen} onOpenChange={setReportOpen} data={data || []} />
    </div>
  );
}
