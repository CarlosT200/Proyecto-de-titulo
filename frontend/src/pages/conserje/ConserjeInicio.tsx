import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Buildings,
  CheckCircle,
  ClockCounterClockwise,
  Package,
  QrCode,
  Siren,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { dashboardApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import clsx from "clsx";
import { Alert, Button, Card, CardHeader, EmptyState, Spinner } from "../../components/ui";
import { Cifra } from "../../components/Cifra";
import { AccesoRapido, HeroBanner, RequiereAtencion, saludoSegunHora } from "../../components/Inicio";
import { DetalleAcceso } from "../../components/DetalleAcceso";
import { ModalAtenderAlerta, unidadDeAlerta } from "../../components/AtenderAlerta";
import { horaLocal } from "../../lib/dias";
import { haceCuanto } from "../../lib/tiempo";
import { ENCOMIENDA_ATRASADA_HORAS } from "../../lib/umbrales";
import { TIPO_EMERGENCIA_LABEL } from "../../lib/badges";
import type { AlertaSos } from "../../types";

// Centro de control de conserjeria: las emergencias primero, despues lo pendiente del turno y los
// atajos a las tareas de todos los dias. Se actualiza solo cada 20 segundos.
export default function ConserjeInicio() {
  const { usuario } = useAuth();
  const { data, cargando, error, setData, recargar } = useAsync(() => dashboardApi.conserjeria(), []);
  const [atendiendo, setAtendiendo] = useState<AlertaSos | null>(null);

  useEffect(() => {
    const intervalo = setInterval(() => {
      dashboardApi.conserjeria().then(setData).catch(() => {});
    }, 20000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <HeroBanner
        etiqueta={
          <>
            <Buildings size={13} weight="fill" aria-hidden /> {usuario?.condominio?.nombre ?? "Conserjería"}
          </>
        }
        titulo={`${saludoSegunHora()}, ${usuario?.nombre ?? ""}`}
        subtitulo="Esto es lo que necesita tu atención en el turno."
      />

      {data && data.sos.alertas.length > 0 && (
        <section
          aria-labelledby="titulo-emergencias"
          className="animate-aparece overflow-hidden rounded-2xl border-2 border-red-300 bg-red-50 shadow-lg shadow-red-500/10 dark:border-red-500/40 dark:bg-red-500/10"
        >
          <div className="flex items-center gap-2 border-b border-red-200 px-5 py-3 dark:border-red-500/30">
            <span className="relative flex h-3 w-3" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
            </span>
            <h2 id="titulo-emergencias" className="font-display text-base font-semibold text-red-800 dark:text-red-200">
              {data.sos.activas === 1 ? "Emergencia activa" : `${data.sos.activas} emergencias activas`}
            </h2>
          </div>
          <ul className="divide-y divide-red-200/70 dark:divide-red-500/20">
            {data.sos.alertas.map((a) => {
              const unidad = unidadDeAlerta(a);
              return (
                <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                      {TIPO_EMERGENCIA_LABEL[a.tipo]} · {a.usuario.nombre} {a.usuario.apellido}
                      {unidad ? ` (${unidad})` : ""}
                    </p>
                    <p className="text-sm text-red-800 dark:text-red-200">Activada {haceCuanto(a.createdAt)}</p>
                  </div>
                  <Button variant="danger" className="min-h-12 shrink-0 max-sm:w-full sm:self-center" onClick={() => setAtendiendo(a)}>
                    <CheckCircle size={16} weight="bold" aria-hidden /> Marcar como atendida
                  </Button>
                </li>
              );
            })}
          </ul>
          {data.sos.activas > data.sos.alertas.length && (
            <Link to="/alertas-sos" className="flex min-h-11 items-center px-5 text-sm font-medium text-red-800 hover:underline dark:text-red-200">
              Ver todas las alertas activas
            </Link>
          )}
        </section>
      )}

      <section aria-label="Acciones rápidas" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <AccesoRapido to="/validar" icon={QrCode} titulo="Escanear QR" descripcion="Validar un acceso" tono="brand" index={0} />
        <AccesoRapido to="/encomiendas?registrar=1" icon={Package} titulo="Registrar encomienda" descripcion="Avisa al residente" tono="purple" index={1} />
        <AccesoRapido to="/alertas-sos" icon={Siren} titulo="Alertas SOS" descripcion="Emergencias" tono="red" index={2} />
        <AccesoRapido to="/accesos" icon={ClockCounterClockwise} titulo="Historial de accesos" descripcion="Quién entró" tono="green" index={3} />
      </section>

      {cargando && !data ? (
        <Spinner />
      ) : error && !data ? (
        <Alert tone="red">{error}</Alert>
      ) : data ? (
        <>
          <RequiereAtencion
            items={[
              {
                cantidad: data.sos.activas,
                singular: "alerta SOS activa",
                plural: "alertas SOS activas",
                to: "/alertas-sos",
                tono: "red",
                icono: Siren,
              },
              {
                cantidad: data.encomiendas.atrasadas,
                singular: `encomienda sin retirar hace más de ${ENCOMIENDA_ATRASADA_HORAS} horas`,
                plural: `encomiendas sin retirar hace más de ${ENCOMIENDA_ATRASADA_HORAS} horas`,
                to: "/encomiendas?estado=ATRASADA",
                tono: "amber",
                icono: Package,
              },
              {
                cantidad: data.accesos.hoyRechazados,
                singular: "acceso rechazado hoy",
                plural: "accesos rechazados hoy",
                to: "/accesos?resultado=RECHAZADO&periodo=hoy",
                tono: "amber",
                icono: XCircle,
              },
            ]}
          />

          <Card plana className="overflow-hidden">
            <CardHeader nivel={2} title="El turno en cifras" subtitle="Toca una cifra para ver la lista." />
            <div className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4 dark:bg-slate-700/60">
              <Cifra to="/encomiendas?estado=NOTIFICADA" icono={Package} etiqueta="Encomiendas" valor={data.encomiendas.pendientes} detalle="por entregar" />
              <Cifra to="/alertas-sos" icono={Siren} etiqueta="Alertas SOS" valor={data.sos.activas} detalle={data.sos.activas === 1 ? "activa" : "activas"} alerta />
              <Cifra to="/accesos?resultado=AUTORIZADO&periodo=hoy" icono={CheckCircle} etiqueta="Autorizados" valor={data.accesos.hoyAutorizados} detalle="accesos de hoy" />
              <Cifra to="/accesos?resultado=RECHAZADO&periodo=hoy" icono={WarningCircle} etiqueta="Rechazados" valor={data.accesos.hoyRechazados} detalle="accesos de hoy" alerta />
            </div>
          </Card>

          <Card plana className="overflow-hidden">
            <CardHeader
              nivel={2}
              title="Accesos recientes"
              action={
                <Link to="/accesos" className="text-sm font-medium text-brand-600 hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center dark:text-brand-400">
                  Ver historial
                </Link>
              }
            />
            {data.accesos.recientes.length === 0 ? (
              <EmptyState icon={QrCode} title="Aún no hay accesos registrados" />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {data.accesos.recientes.map((a) => {
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
                          {a.detalle ? <DetalleAcceso detalle={a.detalle} className="min-w-0" /> : <p className="min-w-0 text-sm font-medium text-slate-900 dark:text-slate-100">{a.motivo}</p>}
                          <span className="shrink-0 text-sm tabular-nums text-slate-600 dark:text-slate-300">{horaLocal(a.createdAt)}</span>
                        </div>
                        <p className={clsx("mt-0.5 text-sm", ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>
                          {ok ? "Autorizado" : "Rechazado"}
                          {a.detalle && !ok ? `: ${a.motivo}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      ) : null}

      {atendiendo && <ModalAtenderAlerta alerta={atendiendo} onClose={() => setAtendiendo(null)} onAtendida={recargar} />}
    </div>
  );
}
