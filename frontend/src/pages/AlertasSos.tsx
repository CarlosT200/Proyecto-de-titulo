import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { CheckCircle, Siren } from "@phosphor-icons/react";
import { sosApi } from "../api/endpoints";
import { useAsync } from "../hooks/useAsync";
import { useFiltroUrl } from "../hooks/useFiltroUrl";
import { Alert, Badge, Button, Card, EmptyState, Label, PageHeader, Select, Spinner, staggerFade } from "../components/ui";
import { ModalAtenderAlerta, unidadDeAlerta } from "../components/AtenderAlerta";
import { formatFechaHora } from "../lib/format";
import { haceCuanto } from "../lib/tiempo";
import { ESTADO_ALERTA_SOS_LABEL, ESTADO_ALERTA_SOS_TONO, TIPO_EMERGENCIA_LABEL, TIPO_EMERGENCIA_TONO } from "../lib/badges";
import type { AlertaSos } from "../types";

const ESTADOS = ["ACTIVA", "ATENDIDA"] as const;
const ETIQUETA_FILTRO: Record<(typeof ESTADOS)[number], string> = { ACTIVA: "Solo activas", ATENDIDA: "Solo atendidas" };

// Compartida entre administracion y conserjeria: ambos necesitan enterarse de inmediato cuando un
// residente activa el boton SOS (ver components/BotonSOS.tsx) y dejar registro de quien lo atendio.
export default function AlertasSos() {
  const { data, cargando, error, setData, recargar } = useAsync(() => sosApi.listar(), []);
  const [estado, setEstado] = useFiltroUrl("estado", ESTADOS);
  const [atendiendo, setAtendiendo] = useState<AlertaSos | null>(null);

  // Se actualiza sola cada 15 segundos, sin parpadear la lista.
  useEffect(() => {
    const intervalo = setInterval(() => {
      sosApi.listar().then(setData).catch(() => {});
    }, 15000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtradas = (data ?? []).filter((a) => !estado || a.estado === estado);
  const activas = (data ?? []).filter((a) => a.estado === "ACTIVA").length;

  return (
    <div className="space-y-6">
      <PageHeader icon={Siren} title="Alertas SOS" subtitle="Emergencias activadas por residentes desde su celular." />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:w-56">
          <Label htmlFor="campo-sos-estado">Mostrar</Label>
          <Select id="campo-sos-estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
            <option value="">Todas las alertas</option>
            {ESTADOS.map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETA_FILTRO[valor]}
              </option>
            ))}
          </Select>
        </div>
        {data && (
          <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {activas === 0 ? "No hay alertas activas." : activas === 1 ? "1 alerta activa." : `${activas} alertas activas.`}
          </p>
        )}
      </div>

      <Card>
        {cargando && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Siren} title="Sin alertas registradas" description="Aquí aparecerán las emergencias que activen los residentes." />
        ) : !filtradas.length ? (
          <EmptyState
            icon={estado === "ACTIVA" ? CheckCircle : Siren}
            title={estado === "ACTIVA" ? "No hay alertas activas" : "Sin resultados"}
            description={estado === "ACTIVA" ? "Todas las emergencias fueron atendidas." : undefined}
          />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {filtradas.map((a, i) => {
              const unidad = unidadDeAlerta(a);
              const activa = a.estado === "ACTIVA";
              return (
                <motion.div
                  key={a.id}
                  {...staggerFade(i)}
                  className={clsx(
                    "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
                    activa && "bg-red-50/70 dark:bg-red-500/10"
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TIPO_EMERGENCIA_TONO[a.tipo]}>{TIPO_EMERGENCIA_LABEL[a.tipo]}</Badge>
                      <Badge tone={ESTADO_ALERTA_SOS_TONO[a.estado]}>
                        {activa && <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" aria-hidden />}
                        {ESTADO_ALERTA_SOS_LABEL[a.estado]}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {a.usuario.nombre} {a.usuario.apellido}
                      {unidad && <span className="font-normal text-slate-500 dark:text-slate-400"> · {unidad}</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatFechaHora(a.createdAt)} · {haceCuanto(a.createdAt)}
                    </p>
                    {!activa && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {a.atendidaPor ? `Atendida por ${a.atendidaPor.nombre} ${a.atendidaPor.apellido}` : "Atendida"}
                        {a.atendidaEn ? ` el ${formatFechaHora(a.atendidaEn)}` : ""}
                        {a.observacion ? `. ${a.observacion}` : ""}
                      </p>
                    )}
                  </div>
                  {activa && (
                    <Button className="shrink-0 self-start sm:self-center" onClick={() => setAtendiendo(a)}>
                      <CheckCircle size={16} weight="bold" aria-hidden /> Marcar como atendida
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      {atendiendo && <ModalAtenderAlerta alerta={atendiendo} onClose={() => setAtendiendo(null)} onAtendida={recargar} />}
    </div>
  );
}
