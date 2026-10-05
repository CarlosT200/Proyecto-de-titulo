import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, MapPin, Package } from "@phosphor-icons/react";
import { encomiendasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, Spinner, staggerFade } from "../../components/ui";
import { AntiguedadEncomienda, ModalEncomienda } from "../../components/Encomiendas";
import { formatFechaHora } from "../../lib/format";
import { ESTADO_ENCOMIENDA_LABEL, ESTADO_ENCOMIENDA_TONO } from "../../lib/badges";
import type { Encomienda } from "../../types";

function FilaEncomienda({ enc, index, onVer }: { enc: Encomienda; index: number; onVer: () => void }) {
  return (
    <motion.div {...staggerFade(index)} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{enc.remitente ?? "Remitente no especificado"}</p>
          <Badge tone={ESTADO_ENCOMIENDA_TONO[enc.estado]}>{ESTADO_ENCOMIENDA_LABEL[enc.estado]}</Badge>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Recibida el {formatFechaHora(enc.fechaRecepcion)}</p>
        {enc.estado === "NOTIFICADA" && (
          <>
            <AntiguedadEncomienda encomienda={enc} />
            <p className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              <MapPin size={13} weight="fill" className="shrink-0 text-brand-500" aria-hidden />
              Retírala en conserjería{enc.ubicacion ? ` (${enc.ubicacion})` : ""}.
            </p>
          </>
        )}
        {enc.estado === "RETIRADA" && enc.fechaRetiro && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Entregada el {formatFechaHora(enc.fechaRetiro)}
            {enc.retiradaPor ? ` a ${enc.retiradaPor}` : ""}
          </p>
        )}
        {enc.estado === "DEVUELTA" && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Devuelta al remitente{enc.motivoDevolucion ? `: ${enc.motivoDevolucion}` : "."}
          </p>
        )}
        {enc.numeroSeguimiento && <p className="text-xs text-slate-500 dark:text-slate-400">N° de seguimiento: {enc.numeroSeguimiento}</p>}
      </div>
      <Button size="sm" variant="secondary" className="shrink-0 self-start whitespace-nowrap sm:self-center" onClick={onVer}>
        {enc.tieneFoto && <Camera size={14} aria-hidden />}
        {enc.tieneFoto ? "Ver foto y detalle" : "Ver detalle"}
      </Button>
    </motion.div>
  );
}

export default function ResidenteEncomiendas() {
  const { data, cargando, error } = useAsync(() => encomiendasApi.mias(), []);
  const [params, setParams] = useSearchParams();
  const abiertaId = params.get("ver");

  function abrir(id: string | null) {
    setParams(id ? { ver: id } : {}, { replace: true });
  }

  const porRetirar = (data ?? []).filter((e) => e.estado === "NOTIFICADA");
  const historial = (data ?? []).filter((e) => e.estado !== "NOTIFICADA");

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Mis encomiendas" subtitle="Lo que llegó a conserjería a tu nombre." />

      {cargando ? (
        <Spinner />
      ) : error ? (
        <Alert tone="red">{error}</Alert>
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={Package} title="No tienes encomiendas registradas" description="Cuando llegue algo a tu nombre, te avisaremos." />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Por retirar"
              subtitle={porRetirar.length ? "Pasa a buscarlas a conserjería." : undefined}
            />
            {porRetirar.length === 0 ? (
              <EmptyState icon={Package} title="No tienes encomiendas por retirar" />
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {porRetirar.map((enc, i) => (
                  <FilaEncomienda key={enc.id} enc={enc} index={i} onVer={() => abrir(enc.id)} />
                ))}
              </div>
            )}
          </Card>

          {historial.length > 0 && (
            <Card>
              <CardHeader title="Historial" />
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {historial.map((enc, i) => (
                  <FilaEncomienda key={enc.id} enc={enc} index={i} onVer={() => abrir(enc.id)} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {abiertaId && <ModalEncomienda id={abiertaId} mostrarResidente={false} onClose={() => abrir(null)} />}
    </div>
  );
}
