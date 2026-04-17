import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";

export default function LmAlertasPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" /> Alertas de Contratos
        </h1>
        <p className="text-sm text-muted-foreground">
          Notificações de contratos a vencer e ações pendentes.
        </p>
      </div>
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          A configuração de alertas será definida no próximo prompt.
        </CardContent>
      </Card>
    </div>
  );
}
