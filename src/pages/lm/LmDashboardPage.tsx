import { Card, CardContent } from "@/components/ui/card";
import { Database } from "lucide-react";

export default function LmDashboardPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" /> Last Mile · Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão geral dos contratos, alertas de vencimento e indicadores da Base LM.
        </p>
      </div>

      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Módulo Last Mile criado. As funcionalidades (filtros personalizados, insights,
          notificações de contratos a vencer) serão configuradas no próximo passo.
        </CardContent>
      </Card>
    </div>
  );
}
