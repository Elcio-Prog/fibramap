import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, NavLink } from "react-router-dom";
import {
  Database, LogOut, Menu, Settings, ChevronLeft, ChevronRight,
  LayoutDashboard, Upload, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BackgroundTasksIndicator from "@/components/BackgroundTasksIndicator";

interface SidebarSection {
  title: string;
  links: { to: string; label: string; icon: React.ElementType; end?: boolean }[];
}

const sections: SidebarSection[] = [
  {
    title: "PRINCIPAL",
    links: [
      { to: "/lm", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/lm/base", label: "Base LM", icon: Database },
      { to: "/lm/importar", label: "Importar", icon: Upload },
      { to: "/lm/alertas", label: "Alertas", icon: Bell },
    ],
  },
];

function getInitials(displayName?: string | null, fullName?: string | null, email?: string | null) {
  const name = displayName || fullName || email?.split("@")[0] || "?";
  return name
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function LmLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<{ display_name: string | null; full_name: string | null; avatar_url: string | null }>({
    display_name: null, full_name: null, avatar_url: null,
  });

  const fetchProfile = () => {
    if (!user) return;
    supabase.from("profiles").select("display_name, full_name, avatar_url").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) setProfile({ display_name: data.display_name, full_name: (data as any).full_name, avatar_url: (data as any).avatar_url });
      });
  };

  useEffect(() => {
    fetchProfile();
    const handler = () => fetchProfile();
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, [user]);

  const profileDisplayName = profile.display_name || profile.full_name || user?.email?.split("@")[0] || "Usuário";

  const handleSignOut = async () => {
    await signOut();
    navigate("/landing");
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out lg:static",
            collapsed ? "w-[68px]" : "w-60",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div
            className={cn(
              "flex h-14 shrink-0 items-center border-b border-sidebar-border px-3",
              collapsed ? "justify-center" : "gap-2"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Database className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="text-lg font-bold tracking-tight text-sidebar-primary-foreground">
                Last Mile
              </span>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
            {sections.map((section) => (
              <div key={section.title} className="mb-4">
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
                        end={l.end}
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

          <div className="shrink-0 border-t border-sidebar-border px-2 py-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex w-full items-center rounded-md transition-colors duration-150 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    collapsed ? "justify-center px-2 py-2" : "gap-3 px-2 py-2"
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="Avatar" />}
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                      {getInitials(profile.display_name, profile.full_name, user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-sidebar-foreground">
                        {profileDisplayName}
                      </p>
                      <p className="truncate text-[11px] text-sidebar-foreground/50">
                        {user?.email ?? ""}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-56 border-sidebar-border bg-sidebar text-sidebar-foreground"
              >
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">
                    {profileDisplayName}
                  </p>
                  <p className="truncate text-[11px] text-sidebar-foreground/50">
                    {user?.email ?? ""}
                  </p>
                </DropdownMenuLabel>

                <DropdownMenuSeparator className="bg-sidebar-border" />
                <DropdownMenuItem
                  onClick={() => navigate("/account")}
                  className="cursor-pointer gap-2 text-sidebar-foreground/80 hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground focus:!bg-sidebar-accent focus:!text-sidebar-accent-foreground"
                >
                  <Settings className="h-4 w-4" />
                  Configurações da Conta
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-sidebar-border" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer gap-2 text-destructive hover:!bg-sidebar-accent hover:!text-destructive focus:!bg-sidebar-accent focus:!text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex h-10 shrink-0 items-center justify-center border-t border-sidebar-border text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 items-center border-b bg-card px-4 lg:hidden">
            <button onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <span className="ml-3 font-bold">Last Mile</span>
            <div className="ml-auto">
              <BackgroundTasksIndicator />
            </div>
          </header>
          <main className="relative flex-1 overflow-auto">
            <div className="pointer-events-none absolute right-3 top-3 z-30 hidden lg:block">
              <div className="pointer-events-auto rounded-md border bg-card/95 shadow-sm backdrop-blur">
                <BackgroundTasksIndicator />
              </div>
            </div>
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
