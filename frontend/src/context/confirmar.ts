import { createContext, useContext } from "react";

// Contexto y hook de la confirmacion propia (reemplaza a window.confirm). El proveedor (que dibuja
// el modal) esta en ConfirmContext.tsx.
export interface ConfirmOptions {
  titulo?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** "peligro" (rojo, por defecto) para acciones destructivas; "normal" para confirmaciones neutras. */
  tono?: "peligro" | "normal";
}

export type Confirmar = (mensaje: string, opciones?: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<Confirmar | undefined>(undefined);

export function useConfirm(): Confirmar {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return ctx;
}
