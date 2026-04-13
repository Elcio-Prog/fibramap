import { useNavigate } from "react-router-dom";
import { Network, Wifi, Lock, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      {/* Header */}
      <div className="mb-12 text-center">

        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          FibraMap Hub  
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Selecione a área que deseja acessar
        </p>
      </div>

      {/* Cards */}
      <div className="grid w-full max-w-2xl gap-6 sm:grid-cols-2">
        {/* Ferramenta WS */}
        <button
          onClick={() => navigate("/ws/login")}
          aria-label="Acessar Ferramenta WS"
          className="group relative flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm transition-all hover:border-accent hover:shadow-lg hover:shadow-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-transform group-hover:scale-110">
            <Wifi className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold">FibraMap Usuários</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Acesso geral 
            </p>
          </div>
          <ArrowRight className="mt-2 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-accent" />
        </button>

        {/* FibraMap */}
        <button
          onClick={() => navigate("/auth")}
          className="group relative flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:scale-110">
            <Network className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold">FibraMap </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Painel administrativo
            </p>
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="h-3 w-3" />
            Somente ADM
          </div>
        </button>
      </div>
    </div>);

}