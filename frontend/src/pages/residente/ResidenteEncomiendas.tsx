import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, MapPin, Package } from "@phosphor-icons/react";
import { encomiendasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Spinner, staggerFade } from "../../components/ui";
import { AntiguedadEncomienda, ModalEncomienda } from "../../components/Encomiendas";
import { formatFechaHora } from "../../lib/format";
import { esAtrasada, esPorRetirar, ordenarEncomiendas } from "../../lib/encomiendas";
import { haceCuanto } from "../../lib/tiempo";
import { ESTADO_ENCOMIENDA_LABEL, ESTADO_ENCOMIENDA_TONO } from "../../lib/badges";
import type { Encomienda } from "../../types";

const HISTORIAL_VISIBLE = 5;

function FilaEncomienda({ enc, index, onVer }: { enc: Encomienda; index: number; onVer: () => void }) {
  return (
    <motion.li {...staggerFade(index)} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{enc.remitente ?? "Remitente no especificado"}</p>
          <Badge tone={ESTADO_ENCOMIENDA_TONO[enc.estado]}>{ESTADO_ENCOMIENDA_LABEL[enc.estado]}</Badge>
        </div>
        {enc.estado === "NOTIFICADA" ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <AntiguedadEncomienda encomienda={enc} />
            </p>
            <p className="flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-200">
              <MapPin size={16} weight="fill" className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
              <span>Retírala en conserjería{enc.ubicacion ? ` (${enc.ubicacion})` : ""}.</span>
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">Recibida el {formatFechaHora(enc.fechaRecepcion)}</p>
        )}
        {enc.estado === "RETIRADA" && enc.fechaRetiro && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Entregada el {formatFechaHora(enc.fechaRetiro)}
            {enc.retiradaPor ? ` a ${enc.retiradaPor}` : ""}
          </p>
        )}
        {enc.estado === "DEVUELTA" && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Devuelta al remitente{enc.motivoDevolucion ? `: ${enc.motivoDevolucion}` : "."}
          </p>
        )}
        {enc.numeroSeguimiento && <p className="text-xs text-slate-500 dark:text-slate-400">N° de seguimiento: {enc.numeroSeguimiento}</p>}
      </div>
      <Button size="sm" variant="secondary" className="shrink-0 self-start whitespace-nowrap max-sm:w-full sm:self-center" onClick={onVer}>
        {enc.tieneFoto && <Camera size={14} aria-hidden />}
        {enc.tieneFoto ? "Ver foto y detalle" : "Ver detalle"}
      </Button>
    </motion.li>
  );
}

export default function ResidenteEncomiendas() {
  const { data, cargando, error } = useAsync(() => encomiendasApi.mias(), []);
  const [params, setParams] = useSearchParams();
  const [verTodoElHistorial, setVerTodoElHistorial] = useState(false);
  const abiertaId = params.get("ver");

  function abrir(id: string | null) {
    setParams(id ? { ver: id } : {}, { replace: true });
  }

  const ordenadas = ordenarEncomiendas(data ?? []);
  const porRetirar = ordenadas.filter(esPorRetirar);
  const historial = ordenadas.filter((e) => !esPorRetirar(e));
  const historialVisible = verTodoElHistorial ? historial : historial.slice(0, HISTORIAL_VISIBLE);
  const masAntigua = porRetirar[0];
  const hayAtrasadas = porRetirar.some(esAtrasada);

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Mis encomiendas" subtitle="Lo que llegó a conserjería a tu nombre." />

      {cargando && !data ? (
        <Spinner />
      ) : error ? (
        <Alert tone="red">{error}</Alert>
      ) : !data?.length ? (
        <Card plana>
          <EmptyState icon={Package} title="No tienes encomiendas registradas" description="Cuando llegue algo a tu nombre, te avisaremos." />
        </Card>
      ) : (
        <>
          {/* Lo primero: cuantas tengo por retirar y desde cuando. */}
          <Card plana>
            <div className="flex items-center gap-4 px-5 py-4">
              <span
                className={
                  hayAtrasadas
                    ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                    : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                }
              >
                <Package size={24} weight="duotone" aria-hidden />
              </span>
              <div className="min-w-0">
                {masAntigua ? (
                  <>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {porRetirar.length === 1 ? "Tienes 1 encomienda por retirar" : `Tienes ${porRetirar.length} encomiendas por retirar`}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {porRetirar.length === 1 ? "Llegó" : "La más antigua llegó"} {haceCuanto(masAntigua.fechaRecepcion)}. Pasa a buscar{porRetirar.length === 1 ? "la" : "las"} a conserjería.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="font-medium text-slate-900 dark:text-white">No tienes encomiendas por retirar</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Cuando llegue algo a tu nombre, te avisaremos.</p>
                  </>
                )}
              </div>
            </div>
          </Card>

          {porRetirar.length > 0 && (
            <Card plana>
              <CardHeader nivel={2} title="Por retirar" />
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {porRetirar.map((enc, i) => (
                  <FilaEncomienda key={enc.id} enc={enc} index={i} onVer={() => abrir(enc.id)} />
                ))}
              </ul>
            </Card>
          )}

          {historial.length > 0 && (
            <Card plana>
              <CardHeader nivel={2} title="Historial" />
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {historialVisible.map((enc, i) => (
                  <FilaEncomienda key={enc.id} enc={enc} index={i} onVer={() => abrir(enc.id)} />
                ))}
              </ul>
              {historial.length > HISTORIAL_VISIBLE && (
                <div className="border-t border-slate-100 px-5 py-2 dark:border-slate-700/60">
                  <button
                    type="button"
                    aria-expanded={verTodoElHistorial}
                    onClick={() => setVerTodoElHistorial((v) => !v)}
                    className="inline-flex items-center rounded text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:min-h-11 dark:text-brand-400"
                  >
                    {verTodoElHistorial ? "Ver menos" : `Ver todo el historial (${historial.length})`}
                  </button>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {abiertaId && <ModalEncomienda id={abiertaId} mostrarResidente={false} onClose={() => abrir(null)} />}
    </div>
  );
}
