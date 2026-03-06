import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import CartDrawer from "@/components/cart/CartDrawer";

export default function CartButton() {
  const { items } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" className="relative gap-1.5" onClick={() => setOpen(true)}>
        <ShoppingCart className="h-4 w-4" />
        {items.length > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] rounded-full">
            {items.length}
          </Badge>
        )}
      </Button>
      <CartDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
