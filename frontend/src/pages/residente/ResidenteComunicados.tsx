import { motion } from "framer-motion";
import { Megaphone } from "@phosphor-icons/react";
import { comunicadosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Card, EmptyState, PageHeader, Spinner, staggerFade } from "../../components/ui";
import { ItemComunicado } from "../../components/Comunicados";

export default function ResidenteComunicados() {
  const { data, cargando, error } = useAsync(() => comunicadosApi.listar(), []);

  return (
    <div className="space-y-6">
      <PageHeader icon={Megaphone} title="Comunicados" subtitle="Avisos publicados por la administración." />

      <Card plana>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Megaphone} title="Aún no hay comunicados publicados" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {data.map((c, i) => (
              <motion.div key={c.id} {...staggerFade(i)}>
                <ItemComunicado comunicado={c} nivel={2} />
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
