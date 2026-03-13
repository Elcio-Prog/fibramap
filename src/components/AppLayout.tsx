import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router-dom";
import { Map, Building2, Calculator, FileText, LogOut, Menu, X, Database, Users, Upload, Search, ClipboardList, Network, Settings, History } from "lucide-react";
import { cn } from "@/lib/utils";
import CartButton from "@/components/cart/CartButton";
import ProfileDropdown from "@/components/ProfileDropdown";

const baseLinks = [
  { to: "/", label: "Mapa", icon: Map },
  { to: "/providers", label: "Provedores", icon: Building2 },
  { to: "/pre-providers", label: "Pré-Cadastro", icon: ClipboardList },
  { to: "/feasibility", label: "Viabilidade", icon: Calculator },
  { to: "/base-lm", label: "Base LM", icon: Database },
  { to: "/history", label: "Histórico", icon: FileText },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links = [
    ...baseLinks,
    ...(isAdmin ? [
      { to: "/ntt-update", label: "Atualizar Rede NTT", icon: Network },
      { to: "/ws-upload", label: "Upload WS", icon: Upload },
      { to: "/ws-single", label: "Busca Unitária WS", icon: Search },
      { to: "/ws-users", label: "Usuários WS", icon: Users },
      { to: "/send-history", label: "Histórico Envios", icon: History },
      { to: "/settings", label: "Configurações", icon: Settings },
    ] : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar-background text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Map className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold">FibraMap</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )
              }
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center justify-between mb-2 px-3">
            <p className="truncate text-xs text-sidebar-foreground/50">{user?.email}</p>
            <CartButton />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b bg-card px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-3 font-bold">FibraMap</span>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
