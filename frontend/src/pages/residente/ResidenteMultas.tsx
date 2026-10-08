import { motion } from "framer-motion";
import clsx from "clsx";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { multasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, staggerFade } from "../../components/ui";
import { formatFecha, formatMonto } from "../../lib/format";
import { ESTADO_MULTA_LABEL, ESTADO_MULTA_TONO } from "../../lib/badges";

export default function ResidenteMultas() {
  const { data, cargando, error } = useAsync(() => multasApi.mias(), []);

  const pendientes = (data ?? []).filter((m) => m.estado === "PENDIENTE");
  const apeladas = (data ?? []).filter((m) => m.estado === "APELADA");
  const porPagar = pendientes.reduce((s, m) => s + m.monto, 0);

  return (
    <div className="space-y-6">
      <PageHeader icon={Warning} title="Mis multas" subtitle="Motivo, monto y estado de tus sanciones." />

      {data && data.length > 0 && (
        <Card plana>
          <div className="flex items-center gap-4 px-5 py-4">
            {porPagar > 0 ? (
              <div className="min-w-0">
                <p className="text-sm text-slate-600 dark:text-slate-300">Por pagar</p>
                <p className="font-display text-2xl font-bold tabular-nums tracking-tight text-amber-700 dark:text-amber-300">{formatMonto(porPagar)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {pendientes.length} {pendientes.length === 1 ? "multa pendiente" : "multas pendientes"}
                  {apeladas.length > 0 ? ` · ${apeladas.length} en apelación` : ""}
                </p>
              </div>
            ) : (
              <>
                <CheckCircle size={32} weight="fill" className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">No tienes multas por pagar</p>
                  {apeladas.length > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {apeladas.length} {apeladas.length === 1 ? "multa en apelación" : "multas en apelación"}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      <Card plana>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Warning} title="No tienes multas registradas" />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {data.map((m, i) => (
              <motion.li key={m.id} {...staggerFade(i)} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-medium text-slate-900 dark:text-slate-100">{m.motivo}</p>
                  <Badge tone={ESTADO_MULTA_TONO[m.estado]}>{ESTADO_MULTA_LABEL[m.estado]}</Badge>
                </div>
                <p className="mt-1 flex items-baseline gap-2">
                  <span
                    className={clsx(
                      "text-base font-semibold tabular-nums",
                      m.estado === "ANULADA" ? "text-slate-500 line-through dark:text-slate-400" : "text-slate-900 dark:text-white"
                    )}
                  >
                    {formatMonto(m.monto)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{formatFecha(m.fecha)}</span>
                </p>
                {m.observaciones && <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{m.observaciones}</p>}
              </motion.li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
