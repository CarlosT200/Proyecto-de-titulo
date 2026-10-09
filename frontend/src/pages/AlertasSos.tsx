import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CheckCircle, Siren } from "@phosphor-icons/react";
import { sosApi } from "../api/endpoints";
import { useAsync } from "../hooks/useAsync";
import { useFiltroUrl } from "../hooks/useFiltroUrl";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Spinner } from "../components/ui";
import { ModalAtenderAlerta, unidadDeAlerta } from "../components/AtenderAlerta";
import { formatFechaHora } from "../lib/format";
import { haceCuanto } from "../lib/tiempo";
import { TIPO_EMERGENCIA_LABEL, TIPO_EMERGENCIA_TONO } from "../lib/badges";
import type { AlertaSos } from "../types";

const VISTAS = ["atendidas"] as const;
const ATENDIDAS_VISIBLES = 20;

// Compartida entre administracion y conserjeria: ambos necesitan enterarse de inmediato cuando un
// residente activa el boton SOS (ver components/BotonSOS.tsx) y dejar registro de quien lo atendio.
// Lo activo va arriba, grande y en rojo; el historial de atendidas queda debajo, discreto.
export default function AlertasSos() {
  const { data, cargando, error, setData, recargar } = useAsync(() => sosApi.listar(), []);
  const [vista, setVista] = useFiltroUrl("vista", VISTAS);
  const [atendiendo, setAtendiendo] = useState<AlertaSos | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  // Se actualiza sola cada 15 segundos, sin parpadear la lista.
  useEffect(() => {
    const intervalo = setInterval(() => {
      sosApi.listar().then(setData).catch(() => {});
    }, 15000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Una alerta que llega con la actualizacion automatica entra con un movimiento corto (no al cargar).
  const conocidas = useRef<Set<string> | null>(null);
  const nuevas = new Set<string>();
  if (data) {
    if (conocidas.current) data.forEach((a) => !conocidas.current!.has(a.id) && nuevas.add(a.id));
  }
  useEffect(() => {
    if (data) conocidas.current = new Set(data.map((a) => a.id));
  }, [data]);

  const activas = (data ?? []).filter((a) => a.estado === "ACTIVA");
  const atendidas = (data ?? []).filter((a) => a.estado === "ATENDIDA");
  const atendidasVisibles = verTodas ? atendidas : atendidas.slice(0, ATENDIDAS_VISIBLES);

  return (
    <div className="space-y-6">
      <PageHeader icon={Siren} title="Alertas SOS" subtitle="Emergencias activadas por residentes desde su celular. Se actualiza sola." />

      {cargando && !data ? (
        <Spinner />
      ) : error ? (
        <Alert tone="red">{error}</Alert>
      ) : (
        <>
          {/* Estado actual, siempre visible y anunciado a lectores de pantalla cuando cambia. */}
          <div
            aria-live="polite"
            className={clsx(
              "flex items-center gap-4 rounded-2xl border px-5 py-4",
              activas.length
                ? "border-red-200 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10"
                : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
            )}
          >
            <span
              className={clsx(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white",
                activas.length ? "bg-red-600" : "bg-emerald-600"
              )}
            >
              {activas.length ? <Siren size={26} weight="fill" aria-hidden /> : <CheckCircle size={26} weight="fill" aria-hidden />}
            </span>
            <div>
              <p className={clsx("font-display text-lg font-bold", activas.length ? "text-red-800 dark:text-red-200" : "text-emerald-800 dark:text-emerald-200")}>
                {activas.length === 0 ? "Sin emergencias activas" : activas.length === 1 ? "1 emergencia activa" : `${activas.length} emergencias activas`}
              </p>
              <p className={clsx("text-sm", activas.length ? "text-red-800 dark:text-red-200" : "text-emerald-800 dark:text-emerald-200")}>
                {activas.length ? "Atiéndela y márcala como atendida para avisar al residente." : "Si un residente activa el botón SOS, aparecerá aquí al instante."}
              </p>
            </div>
          </div>

          {activas.length > 0 && (
            <ul className="space-y-3">
              {activas.map((a) => {
                const unidad = unidadDeAlerta(a);
                return (
                  <li
                    key={a.id}
                    className={clsx(
                      "flex flex-col gap-4 rounded-2xl border-2 border-red-300 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-red-500/50 dark:bg-slate-800",
                      nuevas.has(a.id) && "animate-aparece"
                    )}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={TIPO_EMERGENCIA_TONO[a.tipo]}>{TIPO_EMERGENCIA_LABEL[a.tipo]}</Badge>
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-300">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-red-600 motion-reduce:animate-none" aria-hidden />
                          Activa {haceCuanto(a.createdAt)}
                        </span>
                      </div>
                      <p className="break-words font-display text-lg font-bold text-slate-900 dark:text-white">
                        {a.usuario.nombre} {a.usuario.apellido}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        {unidad ?? "Sin unidad asignada"} · {formatFechaHora(a.createdAt)}
                      </p>
                    </div>
                    <Button className="min-h-12 shrink-0 max-sm:w-full" onClick={() => setAtendiendo(a)}>
                      <CheckCircle size={18} weight="bold" aria-hidden /> Marcar como atendida
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <Card plana className="overflow-hidden">
            <CardHeader
              nivel={2}
              title="Atendidas"
              subtitle={atendidas.length ? `${atendidas.length} en el historial` : undefined}
              action={
                atendidas.length > 0 ? (
                  <button
                    type="button"
                    aria-expanded={vista === "atendidas"}
                    onClick={() => setVista(vista === "atendidas" ? "" : "atendidas")}
                    className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:min-h-0 dark:text-brand-400"
                  >
                    {vista === "atendidas" ? "Ocultar" : "Mostrar"}
                  </button>
                ) : undefined
              }
            />
            {!atendidas.length ? (
              <EmptyState icon={Siren} title="Aún no hay alertas atendidas" />
            ) : vista !== "atendidas" ? (
              <p className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                La última fue {haceCuanto(atendidas[0].atendidaEn ?? atendidas[0].createdAt)}. Toca «Mostrar» para ver quién atendió cada una.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {atendidasVisibles.map((a) => {
                    const unidad = unidadDeAlerta(a);
                    return (
                      <li key={a.id} className="space-y-1 px-5 py-3">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Badge tone={TIPO_EMERGENCIA_TONO[a.tipo]}>{TIPO_EMERGENCIA_LABEL[a.tipo]}</Badge>
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {a.usuario.nombre} {a.usuario.apellido}
                          </span>
                          {unidad && <span className="text-sm text-slate-600 dark:text-slate-300">· {unidad}</span>}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {formatFechaHora(a.createdAt)} · {a.atendidaPor ? `atendió ${a.atendidaPor.nombre} ${a.atendidaPor.apellido}` : "atendida"}
                          {a.atendidaEn ? ` (${formatFechaHora(a.atendidaEn)})` : ""}
                        </p>
                        {a.observacion && <p className="text-sm text-slate-700 dark:text-slate-200">«{a.observacion}»</p>}
                      </li>
                    );
                  })}
                </ul>
                {atendidas.length > ATENDIDAS_VISIBLES && (
                  <div className="border-t border-slate-100 px-5 py-2 dark:border-slate-700/60">
                    <button
                      type="button"
                      aria-expanded={verTodas}
                      onClick={() => setVerTodas((v) => !v)}
                      className="inline-flex min-h-11 items-center rounded text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:min-h-0 dark:text-brand-400"
                    >
                      {verTodas ? "Ver menos" : `Ver todas (${atendidas.length})`}
                    </button>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}

      {atendiendo && <ModalAtenderAlerta alerta={atendiendo} onClose={() => setAtendiendo(null)} onAtendida={recargar} />}
    </div>
  );
}
