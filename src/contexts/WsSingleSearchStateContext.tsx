import { createContext, useContext, useRef, ReactNode } from "react";

/**
 * Mantém o estado completo da página de Busca Unitária em memória global,
 * para que ao trocar de seção e voltar, os resultados, inputs e mapa sejam preservados.
 *
 * Uso: a página chama `getSnapshot()` na montagem (para restaurar) e
 * `setSnapshot(state)` sempre que algum campo relevante mudar.
 */
export type WsSingleSearchSnapshot = Record<string, any>;

interface Ctx {
  getSnapshot: () => WsSingleSearchSnapshot | null;
  setSnapshot: (snap: WsSingleSearchSnapshot) => void;
  clearSnapshot: () => void;
}

const WsSingleSearchStateContext = createContext<Ctx | null>(null);

export function WsSingleSearchStateProvider({ children }: { children: ReactNode }) {
  const ref = useRef<WsSingleSearchSnapshot | null>(null);

  const getSnapshot = () => ref.current;
  const setSnapshot = (snap: WsSingleSearchSnapshot) => {
    ref.current = snap;
  };
  const clearSnapshot = () => {
    ref.current = null;
  };

  return (
    <WsSingleSearchStateContext.Provider value={{ getSnapshot, setSnapshot, clearSnapshot }}>
      {children}
    </WsSingleSearchStateContext.Provider>
  );
}

export function useWsSingleSearchState() {
  const ctx = useContext(WsSingleSearchStateContext);
  if (!ctx) throw new Error("useWsSingleSearchState must be used within WsSingleSearchStateProvider");
  return ctx;
}
