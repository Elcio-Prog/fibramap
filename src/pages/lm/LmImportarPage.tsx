import ImportWizard from "@/components/lm/ImportWizard";
import { Upload } from "lucide-react";

export default function LmImportarPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6" /> Importar Base LM
        </h1>
        <p className="text-sm text-muted-foreground">
          Importação em massa de contratos e atualizações da Base LM.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
