import { ReactNode } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { CaretRight, Icon as PhosphorIcon } from "@phosphor-icons/react";
import { usePulsoAlCambiar } from "../hooks/usePulsoAlCambiar";

// Una cifra del panel dentro de un grupo. Toda la celda es un enlace a la lista ya filtrada (si hay
// a donde ir). Un cero se muestra atenuado para que destaque solo lo que tiene valor; "alerta"
// pinta la cifra en rojo cuando el valor es un problema (ej. una SOS activa).
export function Cifra({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  to,
  alerta = false,
}: {
  icono: PhosphorIcon;
  etiqueta: string;
  valor: string | number;
  detalle?: ReactNode;
  to?: string;
  alerta?: boolean;
}) {
  const vacio = valor === 0 || valor === "Sin datos";
  const pulso = usePulsoAlCambiar(valor);
  const contenido = (
    <>
      {/* Si la cifra cambia con la actualizacion automatica, la celda se ilumina y se apaga (1,2 s):
          indica que algo cambio sin mover nada. Con "reducir movimiento" no se anima. */}
      {pulso > 0 && (
        <span
          key={pulso}
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-cifra-cambio bg-brand-500/10 dark:bg-brand-400/15"
        />
      )}
      <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
        <Icono size={16} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
        <span className="min-w-0 flex-1">{etiqueta}</span>
        {to && (
          <CaretRight
            size={14}
            className="shrink-0 text-slate-400 transition-transform duration-150 ease-salida dark:text-slate-500 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </span>
      <span
        // Un monto largo (ej. "$3.176.250") se achica segun el ancho de la celda (unidades cqi): a
        // 320 px llegaba al borde.
        style={typeof valor === "string" && valor.length > 6 ? { fontSize: `min(1.5rem, ${(100 / (valor.length * 0.62)).toFixed(1)}cqi)` } : undefined}
        className={clsx(
          "mt-1.5 block whitespace-nowrap font-display text-2xl font-bold tabular-nums tracking-tight",
          vacio
            ? "text-slate-500 dark:text-slate-400"
            : alerta
              ? "text-red-600 dark:text-red-400"
              : "text-slate-900 dark:text-white"
        )}
      >
        {typeof valor === "number" ? valor.toLocaleString("es-CL") : valor}
      </span>
      {detalle && <div className="relative mt-0.5 text-xs text-slate-500 dark:text-slate-400">{detalle}</div>}
    </>
  );
  const clases = "relative block h-full bg-white px-4 py-4 [container-type:inline-size] dark:bg-slate-800 sm:px-5";
  return to ? (
    <Link
      to={to}
      className={clsx(
        clases,
        "group transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:hover:bg-slate-700/60"
      )}
    >
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

