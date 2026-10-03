import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, WarningCircle, Info, X } from "@phosphor-icons/react";
import clsx from "clsx";

type ToastTipo = "success" | "error" | "info";

interface Toast {
  id: string;
  tipo: ToastTipo;
  mensaje: string;
}

interface ToastContextValue {
  success: (mensaje: string) => void;
  error: (mensaje: string) => void;
  info: (mensaje: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastTipo, typeof CheckCircle> = {
  success: CheckCircle,
  error: WarningCircle,
  info: Info,
};

const STYLES: Record<ToastTipo, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-slate-800 dark:text-emerald-300",
  error: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-slate-800 dark:text-red-300",
  info: "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-slate-800 dark:text-brand-300",
};

const DURACION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tipo: ToastTipo, mensaje: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, tipo, mensaje }]);
      setTimeout(() => dismiss(id), DURACION_MS);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    success: (mensaje) => push("success", mensaje),
    error: (mensaje) => push("error", mensaje),
    info: (mensaje) => push("info", mensaje),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Anclados debajo del header (top-24, ~71px de alto + margen), no
          abajo: esa esquina la ocupa el boton flotante de SOS
          (BotonSOS.tsx, bottom-6/right-6) y, segun la pagina, tambien puede
          haber contenido (ej. el boton "Activar" de la card de
          Notificaciones en Perfil.tsx) -- bottom-X seguia topandose con
          algo dependiendo del scroll. Debajo del header es la unica zona
          libre en todas las paginas. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-24 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.tipo];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={clsx(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm",
                  STYLES[t.tipo]
                )}
              >
                <Icon size={18} weight="fill" className="mt-0.5 shrink-0" />
                <span className="flex-1">{t.mensaje}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
                  aria-label="Cerrar notificación"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
