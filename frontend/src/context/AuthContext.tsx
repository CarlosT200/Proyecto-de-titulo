import { useCallback, useEffect, useMemo, useState, ReactNode } from "react";
import { authApi } from "../api/endpoints";
import { haySesionLocal, limpiarTokenAntiguo, olvidarSesionLocal } from "../api/client";
import type { Usuario } from "../types";
import { AuthContext } from "./auth";

// La sesion vive en una cookie HttpOnly que maneja el servidor: aqui no hay ningun token. Al cargar
// la app, si existe la marca local de sesion (cookie CSRF legible), se pide el perfil a /auth/me;
// si el servidor dice que no (sesion revocada, vencida o cuenta deshabilitada), se parte sin sesion.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    limpiarTokenAntiguo();
    if (!haySesionLocal()) {
      setCargando(false);
      return;
    }
    authApi
      .me()
      .then(setUsuario)
      .catch(() => olvidarSesionLocal())
      .finally(() => setCargando(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { usuario: u } = await authApi.login(email, password);
    setUsuario(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // sin conexion o sesion ya invalida: igual se cierra localmente
    }
    olvidarSesionLocal();
    setUsuario(null);
  }, []);

  const actualizarUsuario = useCallback((u: Usuario) => setUsuario(u), []);

  const value = useMemo(
    () => ({ usuario, cargando, login, logout, actualizarUsuario }),
    [usuario, cargando, login, logout, actualizarUsuario]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
