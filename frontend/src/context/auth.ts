import { createContext, useContext } from "react";
import type { Usuario } from "../types";

// Contexto y hook de la sesion. El proveedor esta en AuthContext.tsx (archivos separados para que
// Fast Refresh funcione: un archivo de componentes solo exporta componentes).
export interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<Usuario>;
  // Cierra la sesion en el servidor (revoca) y localmente. Nunca lanza: si el servidor no responde,
  // la sesion local se descarta igual.
  logout: () => Promise<void>;
  actualizarUsuario: (usuario: Usuario) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
