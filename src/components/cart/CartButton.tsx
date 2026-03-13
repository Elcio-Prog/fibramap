import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import CartDrawer from "@/components/cart/CartDrawer";

export default function CartButton() {
  const { items } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        {items.length > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] rounded-full">
            {items.length}
          </Badge>
        )}
      </button>
      <CartDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
