import { Wifi } from "lucide-react";

export default function WsDashboard() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 text-center py-20">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Wifi className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">FibraMap - Usuários</h1>
      <p className="text-muted-foreground">
        Em breve novas funcionalidades estarão disponíveis aqui.
      </p>
    </div>
  );
}
