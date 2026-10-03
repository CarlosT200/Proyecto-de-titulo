import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Buildings, Icon as PhosphorIcon } from "@phosphor-icons/react";
import { STAT_TONES } from "./ui";

export function saludoSegunHora(fecha = new Date()): string {
  const hora = fecha.getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

// Banner de bienvenida de las paginas de inicio. Mismo lenguaje visual que la
// credencial digital (degrade marca -> acento, grilla sutil, edificio de marca
// de agua) para que la app se sienta como una sola pieza.
export function HeroBanner({
  etiqueta,
  titulo,
  subtitulo,
  children,
}: {
  etiqueta?: ReactNode;
  titulo: string;
  subtitulo?: string;
  children?: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-accent-600 p-6 text-white shadow-xl shadow-brand-900/20 sm:p-8"
    >
      <div
        aria-hidden
        className="absolute inset-0 animate-grid-drift opacity-[0.12] motion-reduce:animate-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <Buildings aria-hidden size={220} weight="fill" className="pointer-events-none absolute -bottom-10 -right-8 text-white/10" />
      <div aria-hidden className="absolute -left-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden className="absolute bottom-0 right-1/3 h-40 w-40 rounded-full bg-accent-400/30 blur-3xl" />

      <div className="relative">
        {etiqueta && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20 backdrop-blur-sm">
            {etiqueta}
          </span>
        )}
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 max-w-xl text-sm text-white/85 sm:text-base">{subtitulo}</p>}
        {children && <div className="mt-5">{children}</div>}
      </div>
    </motion.section>
  );
}

// Chip informativo dentro del HeroBanner (ej. "2 encomiendas por retirar").
export function ChipHero({ icon: Icon, children, to }: { icon: PhosphorIcon; children: ReactNode; to?: string }) {
  const clases =
    "inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-medium ring-1 ring-white/20 backdrop-blur-sm";
  const contenido = (
    <>
      <Icon size={16} weight="fill" aria-hidden /> {children}
    </>
  );
  return to ? (
    <Link to={to} className={clsx(clases, "max-sm:min-h-11 transition-colors hover:bg-white/25")}>
      {contenido}
    </Link>
  ) : (
    <span className={clases}>{contenido}</span>
  );
}

// Boton de accion dentro del HeroBanner: blanco solido (principal) o translucido.
export function BotonHero({
  to,
  icon: Icon,
  children,
  principal = false,
}: {
  to: string;
  icon: PhosphorIcon;
  children: ReactNode;
  principal?: boolean;
}) {
  return (
    <Link
      to={to}
      className={clsx(
        "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.97]",
        principal
          ? "bg-white text-brand-700 shadow-lg shadow-black/10 hover:bg-brand-50"
          : "bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm hover:bg-white/25"
      )}
    >
      <Icon size={18} weight="bold" aria-hidden />
      {children}
    </Link>
  );
}

// Tarjeta grande de acceso directo: pensada para el celular y para gente no
// tech-savvy -- icono grande con color propio + texto explicito, toda la
// tarjeta es tocable (mas de 44px de alto).
export function AccesoRapido({
  to,
  icon: Icon,
  titulo,
  descripcion,
  tono = "brand",
  index = 0,
}: {
  to: string;
  icon: PhosphorIcon;
  titulo: string;
  descripcion?: string;
  tono?: keyof typeof STAT_TONES;
  index?: number;
}) {
  const colores = STAT_TONES[tono];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 + index * 0.06, ease: "easeOut" }}
    >
      <Link
        to={to}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm shadow-slate-200/50 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-300/40 active:scale-[0.98] dark:border-white/[0.06] dark:bg-slate-800/80 dark:shadow-black/20"
      >
        <div aria-hidden className={clsx("absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl", colores.brillo)} />
        <div className={clsx("relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg", colores.icono)}>
          <Icon size={24} weight="fill" />
        </div>
        <p className="relative mt-3 text-sm font-semibold text-slate-900 dark:text-white">{titulo}</p>
        {descripcion && <p className="relative text-xs text-slate-500 dark:text-slate-400">{descripcion}</p>}
      </Link>
    </motion.div>
  );
}
