import { createContext, useContext } from "react";

// Contexto y hook del tema claro/oscuro. El proveedor esta en ThemeContext.tsx.
export type Tema = "claro" | "oscuro";

export interface ThemeContextValue {
  tema: Tema;
  setTema: (tema: Tema) => void;
  toggleTema: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
