import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Spinner, StatCard, staggerFade } from "../../components/ui";
import { AccesoRapido, HeroBanner, RequiereAtencion, saludoSegunHora } from "../../components/Inicio";
import { DetalleAcceso } from "../../components/DetalleAcceso";
import { ModalAtenderAlerta, unidadDeAlerta } from "../../components/AtenderAlerta";
import { formatFechaHora } from "../../lib/format";
import { haceCuanto } from "../../lib/tiempo";
import { ENCOMIENDA_ATRASADA_HORAS } from "../../lib/umbrales";
import { RESULTADO_ACCESO_LABEL, TIPO_EMERGENCIA_LABEL } from "../../lib/badges";
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
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          aria-labelledby="titulo-emergencias"
          className="overflow-hidden rounded-2xl border border-red-200 bg-red-50 shadow-lg shadow-red-500/10 dark:border-red-500/30 dark:bg-red-500/10"
        >
          <div className="flex items-center gap-2 border-b border-red-200 px-5 py-3 dark:border-red-500/30">
            <span className="relative flex h-3 w-3" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
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
                    <p className="text-xs text-red-700 dark:text-red-300">Activada {haceCuanto(a.createdAt)}</p>
                  </div>
                  <Button variant="danger" className="shrink-0 self-start sm:self-center" onClick={() => setAtendiendo(a)}>
                    <CheckCircle size={16} weight="bold" aria-hidden /> Marcar como atendida
                  </Button>
                </li>
              );
            })}
          </ul>
          {data.sos.activas > data.sos.alertas.length && (
            <Link to="/alertas-sos?estado=ACTIVA" className="block px-5 py-3 text-sm font-medium text-red-700 hover:underline dark:text-red-300">
              Ver todas las alertas activas
            </Link>
          )}
        </motion.section>
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
                to: "/alertas-sos?estado=ACTIVA",
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

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard to="/encomiendas?estado=NOTIFICADA" icon={Package} label="Encomiendas por entregar" value={data.encomiendas.pendientes} tone="purple" index={0} />
            <StatCard to="/alertas-sos?estado=ACTIVA" icon={Siren} label="Alertas SOS activas" value={data.sos.activas} tone="red" index={1} />
            <StatCard to="/accesos?resultado=AUTORIZADO&periodo=hoy" icon={CheckCircle} label="Accesos autorizados hoy" value={data.accesos.hoyAutorizados} tone="green" index={2} />
            <StatCard to="/accesos?resultado=RECHAZADO&periodo=hoy" icon={WarningCircle} label="Accesos rechazados hoy" value={data.accesos.hoyRechazados} tone="amber" index={3} />
          </div>

          <Card>
            <CardHeader
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
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {data.accesos.recientes.map((a, i) => (
                  <motion.div key={a.id} {...staggerFade(i)} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      {a.detalle ? <DetalleAcceso detalle={a.detalle} /> : <p className="text-sm text-slate-700 dark:text-slate-300">{a.motivo}</p>}
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        {a.detalle && a.resultado === "RECHAZADO" ? `${a.motivo} · ` : ""}
                        {formatFechaHora(a.createdAt)}
                      </p>
                    </div>
                    <Badge tone={a.resultado === "AUTORIZADO" ? "green" : "red"}>{RESULTADO_ACCESO_LABEL[a.resultado]}</Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : null}

      {atendiendo && <ModalAtenderAlerta alerta={atendiendo} onClose={() => setAtendiendo(null)} onAtendida={recargar} />}
    </div>
  );
}
