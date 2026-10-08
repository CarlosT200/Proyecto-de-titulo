import clsx from "clsx";
import { usePulsoAlCambiar } from "../hooks/usePulsoAlCambiar";

// Una cifra de un resumen que ademas es un filtro (se toca para filtrar la lista y se vuelve a tocar para
// quitarlo). Si la cifra cambia (al resolver una incidencia, marcar una multa como pagada...) la celda se
// ilumina y se apaga (1,2 s, solo opacidad): indica que algo cambio. Con "reducir movimiento" no se anima.
export function CeldaResumen({
  titulo,
  valor,
  detalle,
  alerta,
  activa,
  onToggle,
}: {
  titulo: string;
  valor: string | number;
  detalle: string;
  /** Color de la cifra cuando no es cero: lo que hay que atender (rojo) o vigilar (ambar). */
  alerta?: "red" | "amber";
  activa: boolean;
  onToggle: () => void;
}) {
  const texto = String(valor);
  const pulso = usePulsoAlCambiar(texto);
  const vacio = texto === "0" || texto === "$0";
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onToggle}
      className={clsx(
        "relative flex flex-col justify-start bg-white px-3 py-4 text-left transition-colors [container-type:inline-size] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:bg-slate-800 dark:hover:bg-slate-700/60 sm:px-5",
        activa && "ring-2 ring-inset ring-brand-500"
      )}
    >
      {pulso > 0 && (
        <span key={pulso} aria-hidden className="pointer-events-none absolute inset-0 animate-cifra-cambio bg-brand-500/10 dark:bg-brand-400/15" />
      )}
      <span className="relative block text-sm text-slate-600 dark:text-slate-300">{titulo}</span>
      <span
        // un monto largo (ej. "$1.250.000") se achica segun el ancho de la celda (unidades cqi)
        style={texto.length > 6 ? { fontSize: `min(1.5rem, ${(100 / (texto.length * 0.62)).toFixed(1)}cqi)` } : undefined}
        className={clsx(
          "relative mt-1 block whitespace-nowrap font-display text-2xl font-bold tabular-nums tracking-tight",
          vacio
            ? "text-slate-500 dark:text-slate-400"
            : alerta === "red"
              ? "text-red-700 dark:text-red-400"
              : alerta === "amber"
                ? "text-amber-700 dark:text-amber-300"
                : "text-slate-900 dark:text-white"
        )}
      >
        {texto}
      </span>
      <span className="relative mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{detalle}</span>
    </button>
  );
}
