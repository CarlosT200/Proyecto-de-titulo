import clsx from "clsx";
import { Link } from "react-router-dom";
import { Buildings } from "@phosphor-icons/react";

export function PieDePagina({ sobreOscuro = false, className }: { sobreOscuro?: boolean; className?: string }) {
  return (
    <footer
      className={clsx(
        "flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center text-xs",
        sobreOscuro ? "text-white/60" : "text-slate-500 dark:text-slate-400",
        className
      )}
    >
      <Buildings size={13} weight="fill" aria-hidden className={sobreOscuro ? "text-white/50" : "text-brand-400"} />
      <span>© {new Date().getFullYear()} HabitaSmart.</span>
      <span>Todos los derechos reservados.</span>
      {/* El ::before agranda el area tactil (44 px) sin cambiar la altura del pie. */}
      <Link
        to="/privacidad"
        className={clsx(
          "relative underline-offset-2 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:underline",
          sobreOscuro ? "hover:text-white" : "hover:text-slate-700 dark:hover:text-slate-200"
        )}
      >
        Aviso de privacidad
      </Link>
    </footer>
  );
}
