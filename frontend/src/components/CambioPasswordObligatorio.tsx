import { FormEvent, useState } from "react";
import { LockKey, SignOut } from "@phosphor-icons/react";
import { authApi } from "../api/endpoints";
import { mensajeError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Alert, Button, Input, Label } from "./ui";
import { PieDePagina } from "./PieDePagina";

// Pantalla que reemplaza a la aplicacion mientras la persona siga usando la contraseña temporal que
// le dio la administracion (cuenta nueva, o contraseña restablecida). La contraseña temporal la
// conoce otra persona: hasta que elija la suya no se puede usar nada mas.
export function CambioPasswordObligatorio() {
  const { usuario, reemplazarSesion, logout } = useAuth();
  const toast = useToast();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva !== repetida) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setGuardando(true);
    try {
      const sesion = await authApi.cambiarPassword(actual, nueva);
      reemplazarSesion(sesion.token, sesion.usuario);
      toast.success("Listo, tu contraseña quedó guardada.");
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 via-slate-50 to-slate-100 px-4 py-10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-brand-900/5 sm:p-8 dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30">
          <LockKey size={28} weight="duotone" />
        </div>
        <h1 className="text-center font-display text-xl font-bold text-slate-900 dark:text-white">
          Elige tu contraseña
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          {usuario ? `Hola, ${usuario.nombre}. ` : ""}Entraste con una contraseña temporal que te entregó la administración. Por tu
          seguridad, elige una propia antes de continuar.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div>
            <Label htmlFor="campo-obligatorio-actual">Contraseña temporal</Label>
            <Input
              id="campo-obligatorio-actual"
              type="password"
              autoComplete="current-password"
              required
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="campo-obligatorio-nueva">Nueva contraseña (mínimo 8 caracteres)</Label>
            <Input
              id="campo-obligatorio-nueva"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="campo-obligatorio-repetir">Repite la nueva contraseña</Label>
            <Input
              id="campo-obligatorio-repetir"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
          </div>
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" className="w-full" loading={guardando}>
            Guardar y continuar
          </Button>
        </form>

        <button
          type="button"
          onClick={logout}
          className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-slate-500 hover:underline max-sm:min-h-11 dark:text-slate-400"
        >
          <SignOut size={14} /> Salir
        </button>
      </div>
      <PieDePagina className="mt-6" />
    </div>
  );
}
