import { motion } from "framer-motion";
import { Package } from "@phosphor-icons/react";
import { encomiendasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, staggerFade } from "../../components/ui";
import { formatFechaHora } from "../../lib/format";
import { ESTADO_ENCOMIENDA_LABEL, ESTADO_ENCOMIENDA_TONO } from "../../lib/badges";

export default function ResidenteEncomiendas() {
  const { data, cargando, error } = useAsync(() => encomiendasApi.mias(), []);

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Mis encomiendas" subtitle="Notificaciones de encomiendas recibidas en conserjería." />

      <Card>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Package} title="No tienes encomiendas registradas" />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {data.map((enc, i) => (
              <motion.div key={enc.id} {...staggerFade(i)} className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{enc.remitente ?? "Remitente no especificado"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Recibida el {formatFechaHora(enc.fechaRecepcion)}</p>
                </div>
                <Badge tone={ESTADO_ENCOMIENDA_TONO[enc.estado]}>{ESTADO_ENCOMIENDA_LABEL[enc.estado]}</Badge>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
