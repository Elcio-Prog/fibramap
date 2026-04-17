import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImportWizard from "@/components/lm/ImportWizard";
import ManualEntryForm from "@/components/lm/ManualEntryForm";
import { Upload, Plus } from "lucide-react";

export default function LmImportarPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6" /> Importar / Cadastrar
        </h1>
        <p className="text-sm text-muted-foreground">
          Suba contratos em massa via planilha ou cadastre manualmente um novo registro.
        </p>
      </div>

      <Tabs defaultValue="planilha">
        <TabsList>
          <TabsTrigger value="planilha" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Importar planilha
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Cadastro manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planilha" className="pt-4">
          <ImportWizard />
        </TabsContent>

        <TabsContent value="manual" className="pt-4">
          <ManualEntryForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
