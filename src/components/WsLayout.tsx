import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router-dom";
import { LogOut, Wifi, Upload, Search, List, ClipboardList, Network } from "lucide-react";
import { cn } from "@/lib/utils";

const wsLinks = [
  { to: "/ws", label: "Upload em Lote", icon: Upload, end: true },
  { to: "/ws/searches", label: "Minhas Buscas", icon: List },
  { to: "/ws/single", label: "Busca Unitária", icon: Search },
  { to: "/ws/pre-providers", label: "Pré-Cadastro", icon: ClipboardList },
  { to: "/ws/ntt-update", label: "Atualizar Rede", icon: Network },
];

export default function WsLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 items-center justify-between border-b bg-card px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Wifi className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold">Ferramenta WS</span>
          </div>
          <nav className="flex items-center gap-1">
            {wsLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )
                }
              >
                <l.icon className="h-3.5 w-3.5" />
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
