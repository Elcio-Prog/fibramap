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

/**
 * ProfileDropdown — exibe e-mail do usuário com dropdown.
 * Para ADMs: mostra opção de navegar para a área oposta (WS ↔ FibraMap).
 * Para usuários comuns: mostra apenas o botão de sair.
 */
export default function ProfileDropdown() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  // Detecta se o ADM está na área WS (rota começa com /ws)
  const isInWsArea = location.pathname.startsWith("/ws");

  const handleSwitchArea = () => {
    // Navegação direta — mesma sessão, sem novo login
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="max-w-[180px] truncate">{user?.email}</span>
        {isAdmin && <ChevronDown className="h-3 w-3 shrink-0" />}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user?.email}</p>
        </DropdownMenuLabel>

        {/* Opção de troca de área — somente para ADMs */}
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
