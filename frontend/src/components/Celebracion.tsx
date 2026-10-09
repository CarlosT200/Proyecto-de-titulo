import clsx from "clsx";

// Check de "listo" que se dibuja (circulo y luego la marca). Solo para momentos de logro: una reserva
// confirmada, quedar al dia. Con "reducir movimiento" aparece ya dibujado.
export function CheckAnimado({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("inline-flex animate-brotar items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/15", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 52 52" width={size * 0.78} height={size * 0.78} fill="none">
        <circle
          cx="26"
          cy="26"
          r="23"
          pathLength={1}
          strokeDasharray="1"
          className="animate-dibujar stroke-emerald-600 dark:stroke-emerald-400"
          strokeWidth="3"
        />
        <path
          d="M15 27 l7.5 7.5 L37.5 19"
          pathLength={1}
          strokeDasharray="1"
          className="animate-dibujar stroke-emerald-600 [animation-delay:260ms] dark:stroke-emerald-400"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
