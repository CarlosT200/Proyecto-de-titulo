import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BellRinging, Camera, Export as IconoCompartir, LockKey, Pencil, ShieldCheck, UserCircle } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { authApi } from "../api/endpoints";
import { mensajeError } from "../api/client";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { abiertaComoApp, esIOS } from "../lib/push";
import { Alert, Button, Card, CardHeader, Input, Label, PageHeader } from "../components/ui";

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
  const [verPasswords, setVerPasswords] = useState(false);

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
      setErrorPassword("Las contraseñas nuevas no coinciden.");
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
        <Card plana className="h-fit">
          <CardHeader nivel={2} title="Datos personales" />
          <form onSubmit={handleGuardarPerfil} className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700">
                  {usuario.fotoUrl ? (
                    <img src={usuario.fotoUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle size={40} className="text-slate-500 dark:text-slate-400" aria-hidden />
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
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">JPG, PNG o WEBP. Máx. 8 MB.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Cuenta de <span className="font-medium text-slate-900 dark:text-white">{ROL_LABEL[usuario.rol]}</span>
              {usuario.condominio?.nombre ? ` · ${usuario.condominio.nombre}` : ""}
            </p>
            <div>
              <Label htmlFor="campo-perfil-1">Correo electrónico</Label>
              <Input id="campo-perfil-1" value={usuario.email} disabled className="bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300" />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Para cambiar tu correo, pídeselo a la administración.</p>
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
              <Label htmlFor="campo-perfil-4">Teléfono (opcional)</Label>
              <Input id="campo-perfil-4" type="tel" inputMode="tel" maxLength={30} autoComplete="tel" value={telefono ?? ""} onChange={(e) => setTelefono(e.target.value)} placeholder="+56 9 1234 5678" />
            </div>
            {errorPerfil && <Alert tone="red">{errorPerfil}</Alert>}
            <Button type="submit" className="w-full" loading={guardandoPerfil}>
              Guardar cambios
            </Button>
          </form>
        </Card>

        <Card plana className="h-fit">
          <CardHeader nivel={2} title="Cambiar contraseña" subtitle="Usa al menos 8 caracteres. Se guarda cifrada." />
          <form onSubmit={handleCambiarPassword} className="space-y-4 p-5">
            <div>
              <Label htmlFor="campo-perfil-5">Contraseña actual</Label>
              <Input id="campo-perfil-5"
                type={verPasswords ? "text" : "password"}
                required
                autoComplete="current-password"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="campo-perfil-6">Nueva contraseña</Label>
              <Input id="campo-perfil-6"
                type={verPasswords ? "text" : "password"}
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
                type={verPasswords ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmarNueva}
                onChange={(e) => setConfirmarNueva(e.target.value)}
              />
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={verPasswords} onChange={(e) => setVerPasswords(e.target.checked)} />
              Mostrar contraseñas
            </label>
            {confirmarNueva && nueva !== confirmarNueva && <p className="text-sm text-amber-700 dark:text-amber-300">Las contraseñas nuevas aún no coinciden.</p>}
            {errorPassword && <Alert tone="red">{errorPassword}</Alert>}
            <Button type="submit" variant="secondary" className="w-full" loading={cambiandoPassword}>
              <LockKey size={16} /> Actualizar contraseña
            </Button>
          </form>
        </Card>
      </div>

      <Card plana className="h-fit">
        <CardHeader
          nivel={2}
          title="Notificaciones"
          subtitle="Recíbelas como notificación del sistema, aunque no tengas HabitaSmart abierto. Solo se activan si tú lo autorizas, guardan un identificador de este navegador y se desactivan en este dispositivo al cerrar sesión."
        />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                push.habilitado ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
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
                    <strong>Agregar a inicio</strong>, abre HabitaSmart desde ese ícono y vuelve aquí para activarlas.
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
              className="shrink-0 max-sm:min-h-11 max-sm:w-full"
              loading={push.cargando}
              onClick={push.habilitado ? handleDesactivarPush : handleActivarPush}
            >
              {push.habilitado ? "Desactivar" : "Activar"}
            </Button>
          )}
        </div>
      </Card>

      <Card plana className="h-fit">
        <CardHeader nivel={2} title="Privacidad" subtitle="Qué datos tuyos usa HabitaSmart y cómo pedir acceso, corrección o eliminación." />
        <div className="p-5">
          <Link
            to="/privacidad"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline max-sm:min-h-11 dark:text-brand-400"
          >
            <ShieldCheck size={18} /> Ver aviso de privacidad
          </Link>
        </div>
      </Card>
    </div>
  );
}
