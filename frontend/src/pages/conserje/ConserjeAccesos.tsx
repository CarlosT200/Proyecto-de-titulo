import { motion } from "framer-motion";
import { ClockCounterClockwise } from "@phosphor-icons/react";
import { qrApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, staggerFade } from "../../components/ui";
import { DetalleAcceso } from "../../components/DetalleAcceso";
import { formatFechaHora } from "../../lib/format";
import { RESULTADO_ACCESO_LABEL } from "../../lib/badges";

export default function ConserjeAccesos() {
  const { data, cargando, error } = useAsync(() => qrApi.accesos(), []);

  return (
    <div className="space-y-6">
      <PageHeader icon={ClockCounterClockwise} title="Historial de accesos" subtitle="Registros de validaciones QR realizadas." />

      <Card>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={ClockCounterClockwise} title="Aún no hay accesos registrados" />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {data.map((a, i) => (
              <motion.div key={a.id} {...staggerFade(i)} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                <div className="min-w-0">
                  {a.detalle ? (
                    <DetalleAcceso detalle={a.detalle} />
                  ) : (
                    <p className="text-sm text-slate-700 dark:text-slate-300">{a.motivo}</p>
                  )}
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
    </div>
  );
}
