import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { LogOut, Network, Wifi, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function getInitials(email?: string) {
  if (!email) return "?";
  const parts = email.split("@")[0].split(/[._-]/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ProfileDropdown() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  const isInWsArea = location.pathname.startsWith("/ws");

  const handleSwitchArea = () => {
    if (isInWsArea) {
      navigate("/");
    } else {
      navigate("/ws");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/landing");
  };

  const displayName = user?.email?.split("@")[0] ?? "Usuário";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
            {getInitials(user?.email ?? undefined)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 text-left hidden sm:block">
          <p className="truncate text-xs font-medium text-foreground leading-tight">
            {displayName}
          </p>
          <p className="truncate text-[10px] text-muted-foreground leading-tight">
            {user?.email ?? ""}
          </p>
        </div>
        {isAdmin && <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user?.email}</p>
        </DropdownMenuLabel>

        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSwitchArea} className="cursor-pointer gap-2">
              {isInWsArea ? (
                <>
                  <Network className="h-4 w-4" />
                  FibraMap
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4" />
                  Ferramenta WS
                </>
              )}
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}