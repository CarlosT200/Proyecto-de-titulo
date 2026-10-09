import { Megaphone } from "@phosphor-icons/react";
import { comunicadosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { ItemComunicado } from "../../components/Comunicados";

export default function ResidenteComunicados() {
  const { data, cargando, error } = useAsync(() => comunicadosApi.listar(), []);

  return (
    <div className="space-y-6">
      <PageHeader icon={Megaphone} title="Comunicados" subtitle="Avisos publicados por la administración." />

      <Card plana>
        {cargando && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Megaphone} title="Aún no hay comunicados publicados" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {data.map((c) => (
              <ItemComunicado key={c.id} comunicado={c} nivel={2} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
