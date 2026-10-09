import { Buildings, IdentificationBadge, MapPin, UserCircle } from "@phosphor-icons/react";
import type { Usuario } from "../types";

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  RESIDENTE: "Residente",
  CONSERJE: "Conserje",
};

// Credencial digital del residente (inspirada en carnets tipo estudiantil):
// foto + datos + el QR real que ya usa conserjeria para autorizar el acceso.
// Banner superior con degrade de marca + avatar que se monta sobre la union
// con el cuerpo blanco -- look de "badge" fisico en vez de una tarjeta plana.
// Se muestra la foto que el propio usuario subio en su perfil; si no subio
// ninguna, un placeholder generico en vez de dejar el espacio vacio. El QR
// rota solo cada "rotacionSegundos" (ver ResidenteQR.tsx) -- la barra de
// progreso es la senal visual de esa vigencia corta, pensada como medida de
// seguridad (si alguien capturara el QR en una foto, deja de servir apenas
// rota, no se queda valido por horas).
export function CredencialResidente({
  usuario,
  qrDataUrl,
  segundosRestantes,
  rotacionSegundos,
}: {
  usuario: Usuario;
  qrDataUrl: string;
  segundosRestantes: number;
  rotacionSegundos: number;
}) {
  const unidad = usuario.departamento
    ? `${usuario.departamento.torre?.nombre ?? ""} ${usuario.departamento.numero}`.trim()
    : null;
  const progreso = Math.max(0, Math.min(100, (segundosRestantes / rotacionSegundos) * 100));

  return (
    <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-3xl shadow-2xl shadow-brand-900/20 ring-1 ring-black/5 dark:shadow-black/40 dark:ring-white/10">
      {/* Banner superior con degrade de marca */}
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-accent-600">
        <div
          className="absolute inset-0 animate-grid-drift opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <Buildings
          size={140}
          weight="fill"
          className="pointer-events-none absolute -right-6 -top-8 text-white/10"
        />
        <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-accent-400/25 blur-2xl" />

        <div className="relative flex items-start justify-between px-5 pt-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
              <Buildings size={16} weight="fill" className="text-white" />
            </div>
            <div>
              <p className="font-display text-xs font-bold leading-none text-white">HabitaSmart</p>
              {usuario.condominio && (
                <p className="mt-0.5 text-[10px] text-white/75">{usuario.condominio.nombre}</p>
              )}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
            <IdentificationBadge size={11} weight="bold" />
            Digital
          </span>
        </div>
      </div>

      {/* Cuerpo blanco, con el avatar montado sobre la union */}
      <div className="relative bg-white px-5 pb-5 pt-12 dark:bg-slate-800">
        <div className="absolute left-1/2 top-0 h-20 w-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[3px] border-white bg-slate-100 shadow-lg dark:border-slate-800 dark:bg-slate-700">
          {usuario.fotoUrl ? (
            <img src={usuario.fotoUrl} alt="Foto" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UserCircle size={44} className="text-slate-400 dark:text-slate-500" />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center text-center">
          <p className="font-display text-lg font-bold leading-tight text-slate-900 dark:text-white">
            {usuario.nombre} {usuario.apellido}
          </p>
          <span className="mt-1.5 inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {ROL_LABEL[usuario.rol]}
          </span>
          {unidad && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <MapPin size={13} weight="fill" className="text-accent-500" />
              {unidad}
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-center">
          <div className="relative rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
            <span className="absolute left-1 top-1 h-3.5 w-3.5 rounded-tl-md border-l-2 border-t-2 border-brand-400" />
            <span className="absolute right-1 top-1 h-3.5 w-3.5 rounded-tr-md border-r-2 border-t-2 border-brand-400" />
            <span className="absolute bottom-1 left-1 h-3.5 w-3.5 rounded-bl-md border-b-2 border-l-2 border-brand-400" />
            <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-br-md border-b-2 border-r-2 border-brand-400" />
            <img src={qrDataUrl} alt="Código QR de acceso" className="h-36 w-36 rounded-lg" />
          </div>
        </div>

        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-[width] duration-1000 ease-linear"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <p className="mt-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
            Por tu seguridad, se actualiza en {segundosRestantes}s
          </p>
        </div>
      </div>
    </div>
  );
}
