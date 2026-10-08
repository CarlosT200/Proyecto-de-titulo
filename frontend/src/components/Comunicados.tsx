import { ReactNode, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Badge } from "./ui";
import { formatFechaHora } from "../lib/format";
import { TIPO_COMUNICADO_LABEL, TIPO_COMUNICADO_TONO } from "../lib/badges";
import type { Comunicado } from "../types";

// Un comunicado en la lista (administracion y residente). El texto largo se recorta a 3 lineas con
// "Ver más" (antes un comunicado extenso ocupaba varias pantallas en el celular) y se respetan los
// saltos de linea que escribio la administracion. El color del tipo solo destaca lo que importa:
// emergencias en rojo y cortes de servicio en ámbar.
export function ItemComunicado({ comunicado, accion, nivel = 3 }: { comunicado: Comunicado; accion?: ReactNode; nivel?: 2 | 3 }) {
  const Titulo = nivel === 2 ? "h2" : "h3";
  const texto = useRef<HTMLParagraphElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [hayMas, setHayMas] = useState(false);

  // Se mide con el texto recortado: si no cabe en 3 lineas, se ofrece "Ver más". Se vuelve a medir
  // al girar el celular o cambiar el ancho.
  useEffect(() => {
    const el = texto.current;
    if (!el) return;
    const medir = () => {
      if (el.classList.contains("line-clamp-3")) setHayMas(el.scrollHeight > el.clientHeight + 1);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [comunicado.contenido]);

  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Titulo className="break-words text-sm font-semibold text-slate-800 dark:text-slate-100">{comunicado.titulo}</Titulo>
          <Badge tone={TIPO_COMUNICADO_TONO[comunicado.tipo] ?? "slate"}>{TIPO_COMUNICADO_LABEL[comunicado.tipo]}</Badge>
        </div>
        <p
          ref={texto}
          className={clsx("mt-1.5 whitespace-pre-line break-words text-sm text-slate-600 dark:text-slate-300", !abierto && "line-clamp-3")}
        >
          {comunicado.contenido}
        </p>
        {hayMas && (
          <button
            type="button"
            aria-expanded={abierto}
            onClick={() => setAbierto((v) => !v)}
            className="mt-1 inline-flex items-center rounded text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:min-h-11 dark:text-brand-400"
          >
            {abierto ? "Ver menos" : "Ver más"}
          </button>
        )}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {formatFechaHora(comunicado.createdAt)}
          {comunicado.autor ? ` · ${comunicado.autor.nombre} ${comunicado.autor.apellido}` : ""}
        </p>
      </div>
      {accion}
    </div>
  );
}
