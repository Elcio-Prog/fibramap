import { Database } from "lucide-react";
import LMContractsTable from "@/components/lm/LMContractsTable";

export default function LmBasePage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" /> Base LM
        </h1>
        <p className="text-sm text-muted-foreground">
          Tabela completa de contratos Last Mile com filtros, ordenação e exportação.
        </p>
      </div>
      <LMContractsTable />
    </div>
  );
}
