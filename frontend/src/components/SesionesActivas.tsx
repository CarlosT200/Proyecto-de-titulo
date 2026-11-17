import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DeviceMobile, Desktop, SignOut } from "@phosphor-icons/react";
import { authApi } from "../api/endpoints";
import { mensajeError } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../context/auth";
import { useToast } from "../context/toast";
import { useConfirm } from "../context/confirmar";
import { describirAgente } from "../lib/sesiones";
import { formatFechaHora } from "../lib/format";
import { haceCuanto } from "../lib/tiempo";
import { Alert, Button, Card, CardHeader, Spinner } from "./ui";
import type { SesionActiva } from "../types";

// "Mi perfil": sesiones abiertas de la propia persona (telefono, computador de conserjeria, etc.).
// Permite cerrar una concreta o todas, por ejemplo si olvido salir en un equipo compartido.
export function SesionesActivas() {
  const toast = useToast();
  const confirmar = useConfirm();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { data, cargando, error, setData } = useAsync(() => authApi.sesiones(), []);
  const [cerrando, setCerrando] = useState<string | null>(null);

  async function cerrar(sesion: SesionActiva) {
    setCerrando(sesion.id);
    try {
      await authApi.cerrarSesion(sesion.id);
      setData((prev) => (prev ?? []).filter((s) => s.id !== sesion.id));
      toast.success("Sesión cerrada.");
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo cerrar la sesión."));
    } finally {
      setCerrando(null);
    }
  }

  async function cerrarTodas() {
    const ok = await confirmar(
      "Se cerrarán todas tus sesiones, incluida esta. Tendrás que volver a iniciar sesión en cada dispositivo.",
      { titulo: "Cerrar todas las sesiones", textoConfirmar: "Cerrar todas" }
    );
    if (!ok) return;
    setCerrando("todas");
    try {
      await authApi.logoutTodas();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudieron cerrar las sesiones."));
      setCerrando(null);
      return;
    }
    await logout();
    navigate("/login");
  }

  const sesiones = data ?? [];

  return (
    <Card plana className="h-fit">
      <CardHeader
        nivel={2}
        title="Sesiones activas"
        subtitle="Dispositivos donde tu cuenta está abierta. Si olvidaste salir en un equipo compartido, ciérrala desde aquí."
        action={
          sesiones.length > 1 ? (
            <Button variant="secondary" size="sm" loading={cerrando === "todas"} onClick={cerrarTodas} className="shrink-0">
              <SignOut size={16} /> Cerrar todas
            </Button>
          ) : undefined
        }
      />
      {cargando && !data ? (
        <Spinner filas={2} />
      ) : error ? (
        <div className="p-5">
          <Alert tone="red">{error}</Alert>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {sesiones.map((s) => {
            const agente = describirAgente(s.agente);
            const Icono = agente.movil ? DeviceMobile : Desktop;
            return (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <Icono size={20} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {agente.texto}
                    {s.actual && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        Esta sesión
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Última actividad {haceCuanto(s.ultimoUsoEn)} · abierta el {formatFechaHora(s.creadaEn)}
                  </p>
                </div>
                {!s.actual && (
                  <Button variant="ghost" size="sm" loading={cerrando === s.id} onClick={() => cerrar(s)} className="shrink-0 max-sm:min-h-11">
                    Cerrar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
