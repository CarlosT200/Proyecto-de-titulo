import clsx from "clsx";
import { CheckCircle, Icon as PhosphorIcon, QrCode, XCircle } from "@phosphor-icons/react";
import { qrApi } from "../api/endpoints";
import { useAsync } from "../hooks/useAsync";
import { useFiltroUrl } from "../hooks/useFiltroUrl";
import { Alert, Card, EmptyState, PageHeader, Spinner } from "./ui";
import { CeldaResumen } from "./CeldaResumen";
import { DetalleAcceso } from "./DetalleAcceso";
import { hoyLocal } from "../lib/format";
import { agruparPorDia, diaLocal, etiquetaDia, horaLocal } from "../lib/dias";

const RESULTADOS = ["AUTORIZADO", "RECHAZADO"] as const;
const PERIODOS = ["hoy"] as const;

// Historial de validaciones de QR (administracion y conserjeria), agrupado por dia. Los filtros viajan
// en la direccion (?resultado=RECHAZADO&periodo=hoy) para que los paneles enlacen a la lista filtrada.
export function HistorialAccesos({
  titulo,
  subtitulo,
  icono,
  mostrarValidador,
}: {
  titulo: string;
  subtitulo: string;
  icono: PhosphorIcon;
  mostrarValidador: boolean;
}) {
  const { data, cargando, error } = useAsync(() => qrApi.accesos(), []);
  const [resultado, setResultado] = useFiltroUrl("resultado", RESULTADOS);
  const [periodo, setPeriodo] = useFiltroUrl("periodo", PERIODOS);

  const esDeHoy = (iso: string) => diaLocal(iso) === hoyLocal();
  const lista = data ?? [];
  const deHoy = lista.filter((a) => esDeHoy(a.createdAt));
  const base = periodo ? deHoy : lista;
  const filtrados = base.filter((a) => !resultado || a.resultado === resultado);
  const grupos = agruparPorDia(filtrados, (a) => a.createdAt);

  return (
    <div className="space-y-6">
      <PageHeader icon={icono} title={titulo} subtitle={subtitulo} />

      {lista.length > 0 && (
        <Card plana className="overflow-hidden">
          <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-700/60">
            <CeldaResumen titulo="Hoy" valor={deHoy.length} detalle={deHoy.length === 1 ? "validación" : "validaciones"} activa={periodo === "hoy"} onToggle={() => setPeriodo(periodo ? "" : "hoy")} />
            <CeldaResumen
              titulo="Autorizados"
              valor={base.filter((a) => a.resultado === "AUTORIZADO").length}
              detalle={periodo ? "hoy" : "en la lista"}
              activa={resultado === "AUTORIZADO"}
              onToggle={() => setResultado(resultado === "AUTORIZADO" ? "" : "AUTORIZADO")}
            />
            <CeldaResumen
              titulo="Rechazados"
              valor={base.filter((a) => a.resultado === "RECHAZADO").length}
              detalle={periodo ? "hoy" : "en la lista"}
              alerta="red"
              activa={resultado === "RECHAZADO"}
              onToggle={() => setResultado(resultado === "RECHAZADO" ? "" : "RECHAZADO")}
            />
          </div>
        </Card>
      )}

      <Card plana className="overflow-hidden">
        {cargando && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !lista.length ? (
          <EmptyState icon={QrCode} title="Aún no hay accesos registrados" description="Cada código QR validado en portería aparecerá aquí." />
        ) : !filtrados.length ? (
          <EmptyState icon={QrCode} title="Sin resultados" description="Ningún acceso coincide con los filtros." />
        ) : (
          <>
            <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              Últimos 100 registros, del más reciente al más antiguo.
            </p>
            {grupos.map((g) => (
              <section key={g.dia} aria-labelledby={`accesos-${g.dia}`}>
                <h2
                  id={`accesos-${g.dia}`}
                  className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300"
                >
                  {etiquetaDia(g.dia)} · {g.items.length}
                </h2>
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {g.items.map((a) => {
                    const ok = a.resultado === "AUTORIZADO";
                    return (
                      <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                        <span
                          className={clsx(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                          )}
                        >
                          {ok ? <CheckCircle size={18} weight="fill" aria-hidden /> : <XCircle size={18} weight="fill" aria-hidden />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            {a.detalle ? (
                              <DetalleAcceso detalle={a.detalle} className="min-w-0" />
                            ) : (
                              <p className="min-w-0 text-sm font-medium text-slate-900 dark:text-slate-100">{a.motivo}</p>
                            )}
                            <span className="shrink-0 text-sm tabular-nums text-slate-600 dark:text-slate-300">{horaLocal(a.createdAt)}</span>
                          </div>
                          <p className={clsx("mt-0.5 text-sm", ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>
                            {ok ? "Autorizado" : "Rechazado"}
                            {a.detalle && !ok ? `: ${a.motivo}` : ""}
                          </p>
                          {mostrarValidador && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Validó {a.validadoPor.nombre} {a.validadoPor.apellido}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}
