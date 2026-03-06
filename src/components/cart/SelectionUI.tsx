import { CartItem } from "@/contexts/CartContext";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShoppingCart, Check } from "lucide-react";

interface Props {
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  buildCartItems: () => CartItem[];
}

export function SelectionCheckbox({
  id,
  checked,
  onToggle,
  inCart,
  sent,
}: {
  id: string;
  checked: boolean;
  onToggle: (id: string) => void;
  inCart: boolean;
  sent: boolean;
}) {
  if (sent) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Check className="h-3.5 w-3.5 text-primary" />
        </TooltipTrigger>
        <TooltipContent>Este registro já foi enviado</TooltipContent>
      </Tooltip>
    );
  }
  if (inCart) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="text-[9px] px-1">No Carrinho</Badge>
        </TooltipTrigger>
        <TooltipContent>Este item já está no carrinho</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={() => onToggle(id)}
      className="h-3.5 w-3.5"
    />
  );
}

export function FloatingActionBar({ selectedIds, onToggleAll, allSelected, buildCartItems }: Props) {
  const { addItems, items: cartItems } = useCart();

  if (selectedIds.size === 0) return null;

  const handleAdd = () => {
    const newItems = buildCartItems();
    addItems(newItems);
    onToggleAll(); // deselect all
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
      <span className="text-sm font-medium">{selectedIds.size} registros selecionados</span>
      <Button size="sm" className="gap-2" onClick={handleAdd}>
        <ShoppingCart className="h-3.5 w-3.5" /> Adicionar ao Carrinho
      </Button>
      {cartItems.length > 0 && (
        <Badge variant="secondary" className="gap-1">
          <ShoppingCart className="h-3 w-3" /> {cartItems.length}
        </Badge>
      )}
    </div>
  );
}
