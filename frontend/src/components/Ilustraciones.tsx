// Ilustraciones de linea para las pantallas vacias (en vez de un icono gris generico). Todas usan el
// azul de la marca para el trazo y un toque de naranja; se ven bien en modo claro y oscuro.

export type NombreIlustracion = "caja" | "calendario" | "comunicado" | "documento" | "herramienta" | "todo-en-orden" | "billetera";

const TRAZO = "stroke-brand-600 dark:stroke-brand-300";
const FONDO = "fill-brand-50 dark:fill-brand-500/10";
const ACENTO = "fill-accent-400 dark:fill-accent-500";
const SUAVE = "fill-white dark:fill-slate-800";

function Destellos() {
  return (
    <g className={ACENTO}>
      <path d="M100 14 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
      <circle cx="14" cy="22" r="2.5" />
      <circle cx="108" cy="70" r="2" />
    </g>
  );
}

function Contenido({ nombre }: { nombre: NombreIlustracion }) {
  switch (nombre) {
    case "caja":
      return (
        <>
          <path d="M34 40 L60 28 L86 40 L60 52 Z" className={SUAVE} />
          <path d="M34 40 v26 l26 12 v-26 Z M86 40 v26 l-26 12 v-26 Z" className={SUAVE} />
          <path d="M34 40 L60 28 L86 40 L60 52 Z M34 40 v26 l26 12 l26 -12 v-26 M60 52 v26" className={TRAZO} strokeWidth="2.5" strokeLinejoin="round" fill="none" />
          <path d="M47 34 l26 12 v8" className="stroke-accent-500" strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      );
    case "calendario":
      return (
        <>
          <rect x="30" y="28" width="60" height="50" rx="8" className={SUAVE} />
          <rect x="30" y="28" width="60" height="50" rx="8" className={TRAZO} strokeWidth="2.5" fill="none" />
          <path d="M30 42 h60" className={TRAZO} strokeWidth="2.5" />
          <path d="M44 22 v12 M76 22 v12" className={TRAZO} strokeWidth="3" strokeLinecap="round" />
          <g className="fill-brand-200 dark:fill-brand-500/40">
            <rect x="40" y="50" width="8" height="7" rx="2" />
            <rect x="56" y="50" width="8" height="7" rx="2" />
            <rect x="40" y="63" width="8" height="7" rx="2" />
          </g>
          <rect x="72" y="50" width="8" height="7" rx="2" className={ACENTO} />
        </>
      );
    case "comunicado":
      return (
        <>
          <path d="M36 44 L74 30 v40 L36 56 Z" className={SUAVE} />
          <path d="M36 44 L74 30 v40 L36 56 Z M36 44 h-6 v12 h6" className={TRAZO} strokeWidth="2.5" strokeLinejoin="round" fill="none" />
          <path d="M42 57 l4 14 h7 l-3 -12" className={TRAZO} strokeWidth="2.5" strokeLinejoin="round" fill="none" />
          <path d="M82 40 q6 10 0 20 M88 34 q10 16 0 32" className="stroke-accent-500" strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      );
    case "documento":
      return (
        <>
          <path d="M40 22 h28 l14 14 v42 a4 4 0 0 1 -4 4 h-38 a4 4 0 0 1 -4 -4 v-52 a4 4 0 0 1 4 -4z" className={SUAVE} />
          <path d="M40 22 h28 l14 14 v42 a4 4 0 0 1 -4 4 h-38 a4 4 0 0 1 -4 -4 v-52 a4 4 0 0 1 4 -4z M68 22 v14 h14" className={TRAZO} strokeWidth="2.5" strokeLinejoin="round" fill="none" />
          <path d="M46 48 h28 M46 57 h28 M46 66 h18" className="stroke-brand-300 dark:stroke-brand-500" strokeWidth="3" strokeLinecap="round" />
          <circle cx="78" cy="70" r="9" className={ACENTO} />
          <path d="M74 70 l3 3 5 -6" className="stroke-white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      );
    case "herramienta":
      return (
        <>
          {/* llave: cabeza con la boca abierta y mango hueco, mas una tuerca */}
          <path d="M45 72 L64 53" className={TRAZO} strokeWidth="12" strokeLinecap="round" />
          <path d="M45 72 L64 53" className="stroke-white dark:stroke-slate-800" strokeWidth="6" strokeLinecap="round" />
          <path d="M71 29 a15 15 0 1 0 15 15 h-10 l-5 -5 z" className={SUAVE} />
          <path d="M71 29 a15 15 0 1 0 15 15 h-10 l-5 -5 z" className={TRAZO} strokeWidth="2.5" strokeLinejoin="round" fill="none" />
          <circle cx="45" cy="72" r="2.2" className="fill-brand-600 dark:fill-brand-300" />
          <path d="M88 60 l6 3.5 v7 l-6 3.5 l-6 -3.5 v-7 z" className={ACENTO} />
          <circle cx="88" cy="67" r="2.6" className="fill-white dark:fill-slate-800" />
        </>
      );
    case "billetera":
      return (
        <>
          <rect x="28" y="34" width="62" height="42" rx="8" className={SUAVE} />
          <rect x="28" y="34" width="62" height="42" rx="8" className={TRAZO} strokeWidth="2.5" fill="none" />
          <path d="M28 44 h62" className={TRAZO} strokeWidth="2.5" />
          <rect x="70" y="52" width="24" height="14" rx="5" className={SUAVE} />
          <rect x="70" y="52" width="24" height="14" rx="5" className={TRAZO} strokeWidth="2.5" fill="none" />
          <circle cx="78" cy="59" r="2.5" className={ACENTO} />
          <path d="M36 28 l30 -8 4 12" className="stroke-accent-500" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      );
    case "todo-en-orden":
    default:
      return (
        <>
          <path d="M60 20 l26 10 v18 c0 18 -12 28 -26 34 c-14 -6 -26 -16 -26 -34 v-18 z" className={SUAVE} />
          <path d="M60 20 l26 10 v18 c0 18 -12 28 -26 34 c-14 -6 -26 -16 -26 -34 v-18 z" className={TRAZO} strokeWidth="2.5" strokeLinejoin="round" fill="none" />
          <path d="M48 50 l8 8 16 -16" className="stroke-accent-500" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      );
  }
}

export function Ilustracion({ nombre }: { nombre: NombreIlustracion }) {
  return (
    <svg viewBox="0 0 120 92" width="132" height="101" aria-hidden className="mb-1">
      <ellipse cx="60" cy="50" rx="50" ry="38" className={FONDO} />
      <Destellos />
      <Contenido nombre={nombre} />
    </svg>
  );
}
