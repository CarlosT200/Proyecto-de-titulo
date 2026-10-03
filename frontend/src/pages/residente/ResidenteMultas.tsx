import { motion } from "framer-motion";
import { Warning } from "@phosphor-icons/react";
import { multasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, staggerFade } from "../../components/ui";
import { formatFecha, formatMonto } from "../../lib/format";
import { ESTADO_MULTA_LABEL, ESTADO_MULTA_TONO } from "../../lib/badges";

export default function ResidenteMultas() {
  const { data, cargando, error } = useAsync(() => multasApi.mias(), []);

  return (
    <div className="space-y-6">
      <PageHeader icon={Warning} title="Mis multas" subtitle="Motivo, monto y estado de tus sanciones." />

      <Card>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Warning} title="No tienes multas registradas" />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {data.map((m, i) => (
              <motion.div key={m.id} {...staggerFade(i)} className="px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{m.motivo}</p>
                  <Badge tone={ESTADO_MULTA_TONO[m.estado]}>{ESTADO_MULTA_LABEL[m.estado]}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {formatFecha(m.fecha)} · {formatMonto(m.monto)}
                </p>
                {m.observaciones && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{m.observaciones}</p>}
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
