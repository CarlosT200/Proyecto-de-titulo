import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { authApi } from "../api/endpoints";
import { clearToken, getToken, setToken } from "../api/client";
import type { Usuario } from "../types";

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<Usuario>;
  logout: () => void;
  actualizarUsuario: (usuario: Usuario) => void;
  // Reemplaza la sesion por una nueva (despues de cambiar la contraseña)
  reemplazarSesion: (token: string, usuario: Usuario) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCargando(false);
      return;
    }
    authApi
      .me()
      .then(setUsuario)
      .catch(() => clearToken())
      .finally(() => setCargando(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, usuario: u } = await authApi.login(email, password);
    setToken(token);
    setUsuario(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUsuario(null);
  }, []);

  const actualizarUsuario = useCallback((u: Usuario) => setUsuario(u), []);

  const reemplazarSesion = useCallback((token: string, u: Usuario) => {
    setToken(token);
    setUsuario(u);
  }, []);

  const value = useMemo(
    () => ({ usuario, cargando, login, logout, actualizarUsuario, reemplazarSesion }),
    [usuario, cargando, login, logout, actualizarUsuario, reemplazarSesion]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
