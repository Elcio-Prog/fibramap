import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface CartItem {
  id: string;
  batchId: string;
  batchTitle: string;
  designacao: string;
  cliente: string;
  cnpj_cliente: string;
  endereco: string;
  cidade: string;
  uf: string;
  lat: number | null;
  lng: number | null;
  is_viable: boolean;
  stage: string;
  provider_name: string;
  velocidade_mbps: number | null;
  velocidade_original: string;
  distance_m: number | null;
  final_value: number | null;
  vigencia: string;
  taxa_instalacao: number | null;
  bloco_ip: string;
  tipo_solicitacao: string;
  valor_a_ser_vendido: number | null;
  codigo_smark: string;
  observacoes_user: string;
  observacoes_system: string;
  created_at: string;
  // New fields
  produto: string;
  tecnologia: string;
  tecnologia_meio_fisico: string;
  coordenadas: string;
}

interface CartCtx {
  items: CartItem[];
  sentIds: Set<string>;
  addItems: (items: CartItem[]) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  markAsSent: (ids: string[]) => void;
  isInCart: (id: string) => boolean;
  isSent: (id: string) => boolean;
  loadSentIds: (ids: string[]) => void;
  updateItem: (id: string, updates: Partial<CartItem>) => void;
  updateItems: (ids: string[], updates: Partial<CartItem>) => void;
}

const CartContext = createContext<CartCtx>({
  items: [],
  sentIds: new Set(),
  addItems: () => {},
  removeItem: () => {},
  clearCart: () => {},
  markAsSent: () => {},
  isInCart: () => false,
  isSent: () => false,
  loadSentIds: () => {},
  updateItem: () => {},
  updateItems: () => {},
});

export const useCart = () => useContext(CartContext);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const addItems = useCallback((newItems: CartItem[]) => {
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const toAdd = newItems.filter((i) => !existingIds.has(i.id) && !sentIds.has(i.id));
      return [...prev, ...toAdd];
    });
  }, [sentIds]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const markAsSent = useCallback((ids: string[]) => {
    setSentIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
  }, []);

  const isInCart = useCallback((id: string) => items.some((i) => i.id === id), [items]);
  const isSent = useCallback((id: string) => sentIds.has(id), [sentIds]);

  const loadSentIds = useCallback((ids: string[]) => {
    setSentIds(new Set(ids));
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<CartItem>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...updates } : i));
  }, []);

  const updateItems = useCallback((ids: string[], updates: Partial<CartItem>) => {
    setItems((prev) => prev.map((i) => ids.includes(i.id) ? { ...i, ...updates } : i));
  }, []);

  return (
    <CartContext.Provider value={{ items, sentIds, addItems, removeItem, clearCart, markAsSent, isInCart, isSent, loadSentIds, updateItem, updateItems }}>
      {children}
    </CartContext.Provider>
  );
}
