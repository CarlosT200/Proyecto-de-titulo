import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { BellRinging, Camera, Export as IconoCompartir, LockKey, Pencil, UserCircle } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authApi } from "../api/endpoints";
import { mensajeError } from "../api/client";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { abiertaComoApp, esIOS } from "../lib/push";
import { Alert, Badge, Button, Card, CardHeader, Input, Label, PageHeader } from "../components/ui";

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  RESIDENTE: "Residente",
  CONSERJE: "Conserje",
};

export default function Perfil() {
  const { usuario, actualizarUsuario, reemplazarSesion } = useAuth();
  const toast = useToast();
  const push = usePushNotifications();
  const iosSinInstalar = !push.soportado && esIOS() && !abiertaComoApp();

  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [apellido, setApellido] = useState(usuario?.apellido ?? "");
  const [telefono, setTelefono] = useState(usuario?.telefono ?? "");
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmarNueva, setConfirmarNueva] = useState("");
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState<string | null>(null);

  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  if (!usuario) return null;

  async function handleFotoChange(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const actualizado = await authApi.subirFoto(archivo);
      actualizarUsuario(actualizado);
      toast.success("Foto de perfil actualizada.");
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo subir la foto."));
    } finally {
      setSubiendoFoto(false);
      e.target.value = "";
    }
  }

  async function handleGuardarPerfil(e: FormEvent) {
    e.preventDefault();
    setErrorPerfil(null);
    setGuardandoPerfil(true);
    try {
      const actualizado = await authApi.actualizarPerfil({ nombre, apellido, telefono: telefono || null });
      actualizarUsuario(actualizado);
      toast.success("Perfil actualizado.");
    } catch (err) {
      setErrorPerfil(mensajeError(err));
    } finally {
      setGuardandoPerfil(false);
    }
  }

  async function handleActivarPush() {
    try {
      await push.activar();
      toast.success("Notificaciones push activadas.");
    } catch (err) {
      toast.error(mensajeError(err, "No se pudieron activar las notificaciones."));
    }
  }

  async function handleDesactivarPush() {
    try {
      await push.desactivar();
      toast.info("Notificaciones push desactivadas.");
    } catch (err) {
      toast.error(mensajeError(err, "No se pudieron desactivar las notificaciones."));
    }
  }

  async function handleCambiarPassword(e: FormEvent) {
    e.preventDefault();
    setErrorPassword(null);
    if (nueva !== confirmarNueva) {
      setErrorPassword("Las contrasenas nuevas no coinciden.");
      return;
    }
    setCambiandoPassword(true);
    try {
      const sesion = await authApi.cambiarPassword(actual, nueva);
      reemplazarSesion(sesion.token, sesion.usuario);
      setActual("");
      setNueva("");
      setConfirmarNueva("");
      toast.success("Contraseña actualizada.");
    } catch (err) {
      setErrorPassword(mensajeError(err));
    } finally {
      setCambiandoPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={UserCircle} title="Mi perfil" subtitle="Datos de tu cuenta y seguridad." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader title="Datos personales" />
          <form onSubmit={handleGuardarPerfil} className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700">
                  {usuario.fotoUrl ? (
                    <img src={usuario.fotoUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle size={40} className="text-slate-400 dark:text-slate-500" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  aria-label={usuario.fotoUrl ? "Cambiar foto" : "Subir foto"}
                  title={usuario.fotoUrl ? "Cambiar foto" : "Subir foto"}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full after:absolute after:-inset-2 after:content-[''] border-2 border-white bg-brand-600 text-white shadow-sm transition-colors hover:bg-brand-700 dark:border-slate-800"
                >
                  <Pencil size={13} weight="bold" />
                </button>
              </div>
              <div>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFotoChange}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={subiendoFoto}
                  onClick={() => fotoInputRef.current?.click()}
                >
                  <Camera size={16} />
                  {usuario.fotoUrl ? "Cambiar foto" : "Subir foto"}
                </Button>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">JPG, PNG o WEBP. Máx. 8MB.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Rol</span>
              <Badge tone="blue">{ROL_LABEL[usuario.rol]}</Badge>
            </div>
            <div>
              <Label htmlFor="campo-perfil-1">Correo electrónico</Label>
              <Input id="campo-perfil-1" value={usuario.email} disabled className="bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="campo-perfil-2">Nombre</Label>
                <Input id="campo-perfil-2" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="campo-perfil-3">Apellido</Label>
                <Input id="campo-perfil-3" required value={apellido} onChange={(e) => setApellido(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="campo-perfil-4">Teléfono</Label>
              <Input id="campo-perfil-4" value={telefono ?? ""} onChange={(e) => setTelefono(e.target.value)} placeholder="+56 9 1234 5678" />
            </div>
            {errorPerfil && <Alert tone="red">{errorPerfil}</Alert>}
            <Button type="submit" className="w-full" loading={guardandoPerfil}>
              Guardar cambios
            </Button>
          </form>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Cambiar contraseña" subtitle="Tu contraseña se guarda cifrada." />
          <form onSubmit={handleCambiarPassword} className="space-y-4 p-5">
            <div>
              <Label htmlFor="campo-perfil-5">Contraseña actual</Label>
              <Input id="campo-perfil-5"
                type="password"
                required
                autoComplete="current-password"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="campo-perfil-6">Nueva contraseña</Label>
              <Input id="campo-perfil-6"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="campo-perfil-7">Confirmar nueva contraseña</Label>
              <Input id="campo-perfil-7"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmarNueva}
                onChange={(e) => setConfirmarNueva(e.target.value)}
              />
            </div>
            {errorPassword && <Alert tone="red">{errorPassword}</Alert>}
            <Button type="submit" variant="secondary" className="w-full" loading={cambiandoPassword}>
              <LockKey size={16} /> Actualizar contraseña
            </Button>
          </form>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader
          title="Notificaciones"
          subtitle="Recíbelas como notificación del sistema, aunque no tengas HabitaSmart abierto. Se desactivan en este dispositivo al cerrar sesión."
        />
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                push.habilitado ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
              }`}
            >
              <BellRinging size={20} weight={push.habilitado ? "fill" : "regular"} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {iosSinInstalar
                  ? "Primero instala HabitaSmart en tu iPhone"
                  : !push.soportado
                    ? "No disponible en este navegador"
                    : push.habilitado
                      ? "Notificaciones push activadas"
                      : "Notificaciones push desactivadas"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {iosSinInstalar ? (
                  <>
                    En Safari toca <IconoCompartir size={13} className="inline -mt-0.5" /> <strong>Compartir</strong> →{" "}
                    <strong>Agregar a inicio</strong>, abre HabitaSmart desde ese icono y vuelve aqui para activarlas.
                  </>
                ) : push.soportado ? (
                  "Incluye alertas SOS, multas, comunicados y más."
                ) : (
                  "Prueba desde Chrome, Edge o Firefox."
                )}
              </p>
            </div>
          </div>
          {push.soportado && push.listo && (
            <Button
              type="button"
              variant={push.habilitado ? "secondary" : "primary"}
              size="sm"
              loading={push.cargando}
              onClick={push.habilitado ? handleDesactivarPush : handleActivarPush}
            >
              {push.habilitado ? "Desactivar" : "Activar"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
