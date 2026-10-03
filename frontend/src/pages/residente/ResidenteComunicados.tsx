import { motion } from "framer-motion";
import { Megaphone } from "@phosphor-icons/react";
import { comunicadosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner, staggerFade } from "../../components/ui";
import { formatFechaHora } from "../../lib/format";
import { TIPO_COMUNICADO_LABEL } from "../../lib/badges";

export default function ResidenteComunicados() {
  const { data, cargando, error } = useAsync(() => comunicadosApi.listar(), []);

  return (
    <div className="space-y-6">
      <PageHeader icon={Megaphone} title="Comunicados" subtitle="Avisos publicados por la administración (HU-16)." />

      <Card>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Megaphone} title="Aún no hay comunicados publicados" />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {data.map((c, i) => (
              <motion.div key={c.id} {...staggerFade(i)} className="px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.titulo}</p>
                  <Badge tone="blue">{TIPO_COMUNICADO_LABEL[c.tipo]}</Badge>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{c.contenido}</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{formatFechaHora(c.createdAt)}</p>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
