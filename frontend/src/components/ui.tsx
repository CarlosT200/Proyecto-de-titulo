import {
  ButtonHTMLAttributes,
  forwardRef,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import clsx from "clsx";
import { ArrowUpRight, CheckCircle, Icon as PhosphorIcon, MagnifyingGlass, Tray, Warning, WarningCircle, X } from "@phosphor-icons/react";

// Animacion de entrada escalonada para filas de tabla / items de lista.
// Uso: data.map((item, i) => <motion.tr key={item.id} {...staggerFade(i)}>...</motion.tr>)
export function staggerFade(index: number) {
  return {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, delay: Math.min(index * 0.04, 0.4) },
  };
}

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
>;

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  children,
  ...props
}: NativeButtonProps & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: props.disabled || loading ? 1 : 0.97 }}
      transition={{ duration: 0.1 }}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60",
        size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs",
        "max-sm:min-h-11",
        variant === "primary" &&
          "bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-md shadow-brand-600/25 hover:shadow-lg hover:shadow-brand-600/40 hover:brightness-110",
        variant === "secondary" && "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700",
        variant === "danger" && "bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </motion.button>
  );
}

export function Card({ className, children, plana = false }: { className?: string; children: ReactNode; plana?: boolean }) {
  if (plana) {
    // Pantallas de trabajo (DESIGN.md, "Flat-At-Work"): superficie solida con borde y una sombra
    // minima, sin translucidez ni movimiento. Se va aplicando pantalla por pantalla.
    return (
      <div
        className={clsx(
          "rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 dark:border-white/[0.06] dark:bg-slate-800 dark:shadow-none",
          className
        )}
      >
        {children}
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      // Levemente translucido + blur: deja ver el brillo de color del fondo
      // (AppLayout) y da profundidad, sin bajar el contraste del texto.
      className={clsx(
        "rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/50 backdrop-blur-sm transition-shadow hover:shadow-xl hover:shadow-slate-300/40 dark:border-white/[0.06] dark:bg-slate-800/80 dark:shadow-black/20 dark:hover:shadow-black/40",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  nivel = 3,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Nivel del titulo para lectores de pantalla (el aspecto es el mismo). */
  nivel?: 2 | 3;
}) {
  const Titulo = nivel === 2 ? "h2" : "h3";
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700/60">
      <div>
        <Titulo className="font-display text-sm font-semibold text-slate-900 dark:text-white">{title}</Titulo>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={clsx("relative", className)}>
      <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <input
        type="search"
        aria-label={placeholder.replace(/\.+$/, "")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full max-sm:min-h-11 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-base text-slate-900 placeholder:text-slate-400 sm:text-sm transition-shadow focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  );
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: PhosphorIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-wrap items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3.5">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/30 ring-1 ring-white/20">
          <Icon size={24} weight="duotone" />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-slate-50 bg-accent-500 dark:border-slate-950" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </motion.div>
  );
}

// icono: degrade solido con icono blanco; brillo: mancha difusa de fondo del mismo tono.
export const STAT_TONES: Record<string, { icono: string; brillo: string }> = {
  slate: { icono: "from-slate-500 to-slate-700 shadow-slate-500/30", brillo: "bg-slate-400/20" },
  brand: { icono: "from-brand-500 to-brand-700 shadow-brand-600/30", brillo: "bg-brand-500/20" },
  green: { icono: "from-emerald-400 to-emerald-600 shadow-emerald-500/30", brillo: "bg-emerald-500/20" },
  amber: { icono: "from-amber-400 to-orange-500 shadow-amber-500/30", brillo: "bg-amber-500/20" },
  red: { icono: "from-red-500 to-rose-600 shadow-red-500/30", brillo: "bg-red-500/20" },
  purple: { icono: "from-violet-500 to-purple-700 shadow-purple-500/30", brillo: "bg-purple-500/20" },
};

function AnimatedNumber({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState("0");
  const rounded = useTransform(motionValue, (v) => Math.round(v).toLocaleString("es-CL"));

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.7, ease: "easeOut" });
    const unsubscribe = rounded.on("change", setDisplay);
    return () => {
      controls.stop();
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display}</>;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "brand",
  index = 0,
  to,
  valorTexto,
}: {
  icon: PhosphorIcon;
  label: string;
  value: number;
  tone?: keyof typeof STAT_TONES;
  index?: number;
  to?: string;
  /** Si se indica, se muestra en vez del numero (ej. "1,5 días"). */
  valorTexto?: string;
}) {
  const colors = STAT_TONES[tone];
  const contenido = (
    <>
      <div className={clsx("pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl", colors.brillo)} aria-hidden />
      <div className="relative flex items-start justify-between gap-2">
        <div className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg", colors.icono)}>
          <Icon size={22} weight="fill" />
        </div>
        {to && (
          <ArrowUpRight
            size={16}
            weight="bold"
            className="text-slate-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-slate-600"
            aria-hidden
          />
        )}
      </div>
      <p
        className="relative mt-4 whitespace-nowrap font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
        // Un texto largo (ej. "$6.357.750") se achica segun el ancho de la tarjeta (unidades cqi): en
        // celular, con dos tarjetas por fila, se cortaba.
        style={valorTexto ? { fontSize: `min(1.875rem, ${(100 / (valorTexto.length * 0.62)).toFixed(1)}cqi)` } : undefined}
      >
        {valorTexto ?? <AnimatedNumber value={value} />}
      </p>
      <p className="relative mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
    </>
  );

  const className = clsx(
    "group relative block h-full overflow-hidden rounded-2xl border [container-type:inline-size] border-slate-200/80 bg-white/90 p-5 shadow-sm shadow-slate-200/50 backdrop-blur-sm transition-shadow hover:shadow-xl hover:shadow-slate-300/40 dark:border-white/[0.06] dark:bg-slate-800/80 dark:shadow-black/20",
    to && "hover:border-brand-300 dark:hover:border-brand-500/50"
  );

  return (
    // h-full (aqui y en la tarjeta): en una grilla todas quedan del mismo alto aunque una etiqueta
    // ocupe dos lineas.
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      {to ? (
        <Link to={to} className={className}>
          {contenido}
        </Link>
      ) : (
        <div className={className}>{contenido}</div>
      )}
    </motion.div>
  );
}

// --- Graficos (HU-24): barras horizontales con spec fijo (grosor <=24px, extremo
// redondeado 4px, gap de 2px entre marcas, valor directo en la punta) y un medidor
// para razones simples (autorizados vs rechazados), siguiendo la skill de dataviz.

export interface BarChartItem {
  label: string;
  value: number;
  color: string;
}

export function HorizontalBarChart({ items }: { items: BarChartItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5 p-5">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-xs text-slate-500 dark:text-slate-400">{item.label}</span>
          <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / max) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.06 }}
              className="h-full rounded-full"
              style={{ backgroundColor: item.color }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Meter({
  label,
  value,
  total,
  color = "#0ca30c",
}: {
  label: string;
  value: number;
  total: number;
  color?: string;
}) {
  const porcentaje = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {value} / {total} · {porcentaje}%
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${porcentaje}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300" {...props} />;
}

// text-base en celular: con menos de 16px, Safari de iPhone hace zoom al enfocar
// el campo y la persona tiene que alejar a mano despues de cada formulario.
const CAMPO_CLASES =
  "w-full max-sm:min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 sm:text-sm transition-shadow focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={clsx(CAMPO_CLASES, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref
) {
  return <textarea ref={ref} className={clsx(CAMPO_CLASES, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select ref={ref} className={clsx(CAMPO_CLASES, className)} {...props}>
      {children}
    </select>
  );
});

const BADGE_TONES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
};

export function Badge({ tone = "slate", children }: { tone?: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Tray,
}: {
  title: string;
  description?: string;
  icon?: PhosphorIcon;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-2 py-12 text-center"
    >
      <div className="relative mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-accent-50 text-brand-500 ring-1 ring-brand-100 dark:from-brand-500/15 dark:to-accent-500/10 dark:text-brand-300 dark:ring-white/10">
        <Icon size={26} weight="duotone" />
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    </motion.div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center justify-center py-10", className)}>
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  );
}

const ALERT_ICON = {
  red: WarningCircle,
  green: CheckCircle,
  amber: Warning,
};

export function Alert({ tone = "red", children }: { tone?: "red" | "green" | "amber"; children: ReactNode }) {
  const tones = {
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  };
  const Icon = ALERT_ICON[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={clsx("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", tones[tone])}
    >
      <Icon size={18} weight="fill" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </motion.div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const tituloId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Ref (no dependencia del efecto): onClose suele ser una funcion inline que
  // cambia en cada render; si el efecto dependiera de ella se re-ejecutaria al
  // escribir en un input del modal y le robaria el foco.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const enfocadoAntes = document.activeElement as HTMLElement | null;
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foco al panel (no al primer input: en celular abriria el teclado sin pedirlo).
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    function alPresionarTecla(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Con un modal abierto encima de otro, Escape cierra solo el de arriba (el ultimo en el DOM).
      const dialogos = document.querySelectorAll('[role="dialog"]');
      if (dialogos.length > 0 && dialogos[dialogos.length - 1] !== panelRef.current) return;
      onCloseRef.current();
    }
    document.addEventListener("keydown", alPresionarTecla);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", alPresionarTecla);
      document.body.style.overflow = overflowAntes;
      enfocadoAntes?.focus?.();
    };
  }, [open]);

  // Se dibuja directo en <body>: si quedara dentro de una tarjeta con blur o animacion, "fixed"
  // se mediria contra esa tarjeta y el modal podria quedar fuera de la pantalla.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/60"
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl outline-none dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700/60">
              <h3 id={tituloId} className="font-display text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 max-sm:-mr-2 max-sm:p-3 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
