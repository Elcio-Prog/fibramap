import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImportWizard from "@/components/lm/ImportWizard";
import ManualEntryForm from "@/components/lm/ManualEntryForm";
import RadiusSearch from "@/components/lm/RadiusSearch";
import { useComprasLM } from "@/hooks/useComprasLM";
import { Upload, Plus, Search, Database } from "lucide-react";

export default function BaseLMPage() {
  const { data: compras } = useComprasLM();
  const total = compras?.length || 0;
  const geocoded = compras?.filter(c => c.geocoding_status === "done").length || 0;
  const pending = compras?.filter(c => c.geocoding_status === "pending").length || 0;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" /> Base LM
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} registros · {geocoded} geocodificados · {pending} pendentes
          </p>
        </div>
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Importar
          </TabsTrigger>
          <TabsTrigger value="complement" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Complemento
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Cadastro
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="h-3.5 w-3.5" /> Busca Raio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <ImportWizard />
        </TabsContent>

        <TabsContent value="complement">
          <ImportWizard isComplement />
        </TabsContent>

        <TabsContent value="manual">
          <ManualEntryForm />
        </TabsContent>

        <TabsContent value="search">
          <RadiusSearch />
        </TabsContent>
      </Tabs>
    </div>
  );
}
