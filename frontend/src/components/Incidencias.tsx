import clsx from "clsx";
import { Check, ChatText } from "@phosphor-icons/react";
import { formatFechaHora } from "../lib/format";
import { ESTADO_INCIDENCIA_LABEL } from "../lib/badges";
import type { EstadoIncidencia, Incidencia, IncidenciaHistorialItem } from "../types";

const PASOS: EstadoIncidencia[] = ["REPORTADA", "EN_REVISION", "EN_PROCESO", "RESUELTA"];

// Historial de una incidencia: cambios de estado y comentarios, en orden.
export function HistorialIncidencia({ historial }: { historial: IncidenciaHistorialItem[] }) {
  if (historial.length === 0) return <p className="text-xs text-slate-500 dark:text-slate-400">Sin movimientos.</p>;
  return (
    <ol className="space-y-2">
      {historial.map((h) => {
        const esComentario = Boolean(h.estadoAnterior) && h.estadoAnterior === h.estadoNuevo;
        const titulo = !h.estadoAnterior
          ? ESTADO_INCIDENCIA_LABEL[h.estadoNuevo] ?? h.estadoNuevo
          : esComentario
            ? "Comentario"
            : `Pasó a ${ESTADO_INCIDENCIA_LABEL[h.estadoNuevo] ?? h.estadoNuevo}`;
        return (
          <li key={h.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
            <p className="flex flex-wrap items-center gap-x-1">
              {esComentario && <ChatText size={13} className="text-brand-500" aria-hidden />}
              <span className="font-medium text-slate-700 dark:text-slate-200">{titulo}</span>
              <span className="text-slate-400 dark:text-slate-500">
                · {h.usuario.nombre} {h.usuario.apellido} · {formatFechaHora(h.createdAt)}
              </span>
            </p>
            {h.observacion && <p className="mt-0.5 whitespace-pre-line text-slate-600 dark:text-slate-300">{h.observacion}</p>}
          </li>
        );
      })}
    </ol>
  );
}

// Seguimiento para el residente: en que paso va su incidencia y cuando llego a cada uno.
export function SeguimientoIncidencia({ incidencia }: { incidencia: Incidencia }) {
  const actual = PASOS.indexOf(incidencia.estado);
  const fechaDe = (paso: EstadoIncidencia) =>
    paso === "REPORTADA"
      ? incidencia.createdAt
      : incidencia.historial?.find((h) => h.estadoNuevo === paso && h.estadoAnterior !== paso)?.createdAt;

  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-2" aria-label="Seguimiento de la incidencia">
      {PASOS.map((paso, i) => {
        const hecho = i <= actual;
        const esActual = i === actual;
        const fecha = hecho ? fechaDe(paso) : undefined;
        return (
          <li key={paso} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2" aria-current={esActual ? "step" : undefined}>
            <div className="flex items-center gap-2 sm:w-full">
              <span
                className={clsx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  hecho
                    ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-600/30"
                    : "border-2 border-slate-200 text-slate-400 dark:border-slate-600 dark:text-slate-500",
                  esActual && "ring-4 ring-brand-100 dark:ring-brand-500/20"
                )}
              >
                {hecho && !esActual ? <Check size={14} weight="bold" aria-hidden /> : i + 1}
              </span>
              {i < PASOS.length - 1 && (
                <span
                  aria-hidden
                  className={clsx("hidden h-0.5 flex-1 rounded sm:block", i < actual ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700")}
                />
              )}
            </div>
            <div>
              <p
                className={clsx(
                  "text-sm font-medium",
                  hecho ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
                )}
              >
                {ESTADO_INCIDENCIA_LABEL[paso]}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {fecha ? formatFechaHora(fecha) : hecho ? "" : "Pendiente"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
