import { ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { NavLink } from "react-router-dom";
import {
  Map, Building2, Calculator, FileText, LogOut, Menu,
  Database, Users, Upload, Search, ClipboardList, Network,
  Settings, History, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CartButton from "@/components/cart/CartButton";
import ProfileDropdown from "@/components/ProfileDropdown";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SidebarSection {
  title: string;
  links: { to: string; label: string; icon: React.ElementType }[];
}

const baseSections: SidebarSection[] = [
  {
    title: "PRINCIPAL",
    links: [
      { to: "/", label: "Mapa", icon: Map },
      { to: "/providers", label: "Provedores", icon: Building2 },
      { to: "/pre-providers", label: "Pré-Cadastro", icon: ClipboardList },
    ],
  },
  {
    title: "DADOS",
    links: [
      { to: "/feasibility", label: "Viabilidade", icon: Calculator },
      { to: "/base-lm", label: "Base LM", icon: Database },
      { to: "/history", label: "Histórico", icon: FileText },
    ],
  },
];

const adminSection: SidebarSection = {
  title: "SISTEMA",
  links: [
    { to: "/ntt-update", label: "Atualizar Rede NTT", icon: Network },
    { to: "/ws-upload", label: "Upload WS", icon: Upload },
    { to: "/ws-single", label: "Busca Unitária WS", icon: Search },
    { to: "/ws-users", label: "Usuários WS", icon: Users },
    { to: "/send-history", label: "Histórico Envios", icon: History },
    { to: "/settings", label: "Configurações", icon: Settings },
  ],
};

function getInitials(email?: string) {
  if (!email) return "?";
  const parts = email.split("@")[0].split(/[._-]/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = [...baseSections, ...(isAdmin ? [adminSection] : [])];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out lg:static",
            collapsed ? "w-[68px]" : "w-60",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* Header */}
          <div
            className={cn(
              "flex h-14 shrink-0 items-center border-b border-sidebar-border px-3",
              collapsed ? "justify-center" : "gap-2"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Map className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="text-lg font-bold tracking-tight text-sidebar-primary-foreground">
                FibraMap
              </span>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
            {sections.map((section) => (
              <div key={section.title} className="mb-4">
                {/* Section label */}
                {!collapsed && (
                  <p className="mb-1.5 px-4 text-[11px] font-semibold uppercase tracking-widest text-sidebar-section">
                    {section.title}
                  </p>
                )}

                <div className="space-y-0.5 px-2">
                  {section.links.map((l) => {
                    const linkContent = (
                      <NavLink
                        key={l.to}
                        to={l.to}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                            collapsed ? "justify-center" : "gap-3",
                            isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )
                        }
                      >
                        <l.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{l.label}</span>}
                      </NavLink>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={l.to}>
                          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                          <TooltipContent side="right" className="font-medium">
                            {l.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return linkContent;
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="shrink-0 border-t border-sidebar-border p-3">
            {/* Cart */}
            <div className={cn("mb-2 flex items-center", collapsed ? "justify-center" : "justify-end px-1")}>
              <CartButton />
            </div>

            {/* User row */}
            <div
              className={cn(
                "flex items-center rounded-md px-2 py-2",
                collapsed ? "justify-center" : "gap-3"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0 bg-sidebar-primary text-sidebar-primary-foreground">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                  {getInitials(user?.email ?? undefined)}
                </AvatarFallback>
              </Avatar>

              {!collapsed && (
                <div className="flex flex-1 items-center justify-between min-w-0">
                  <ProfileDropdown />
                </div>
              )}
            </div>
          </div>

          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex h-10 shrink-0 items-center justify-center border-t border-sidebar-border text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 items-center border-b bg-card px-4 lg:hidden">
            <button onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <span className="ml-3 font-bold">FibraMap</span>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
