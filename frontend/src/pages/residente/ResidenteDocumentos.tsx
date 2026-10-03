import { motion } from "framer-motion";
import { ArrowRight, FileText } from "@phosphor-icons/react";
import { documentosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Card, EmptyState, PageHeader, Spinner, staggerFade } from "../../components/ui";
import { formatFecha } from "../../lib/format";

export default function ResidenteDocumentos() {
  const { data, cargando, error } = useAsync(() => documentosApi.listar(), []);

  return (
    <div className="space-y-6">
      <PageHeader icon={FileText} title="Documentos" subtitle="Reglamentos y documentos informativos del condominio (HU-23)." />

      <Card>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={FileText} title="Aún no hay documentos publicados" />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {data.map((doc, i) => (
              <motion.a
                key={doc.id}
                {...staggerFade(i)}
                href={doc.archivoUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{doc.titulo}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {doc.categoria ?? "General"} · {formatFecha(doc.createdAt)}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs text-brand-600 transition-transform group-hover:translate-x-0.5">
                  Ver <ArrowRight size={14} />
                </span>
              </motion.a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
