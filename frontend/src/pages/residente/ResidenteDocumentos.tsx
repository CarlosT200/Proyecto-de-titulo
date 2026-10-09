import { FileText } from "@phosphor-icons/react";
import { documentosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { ListaDocumentos } from "../../components/Documentos";
import { abrirDocumento } from "../../lib/documentos";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export default function ResidenteDocumentos() {
  const toast = useToast();
  const { data, cargando, error } = useAsync(() => documentosApi.listar(), []);

  return (
    <div className="space-y-6">
      <PageHeader icon={FileText} title="Documentos" subtitle="Reglamentos y documentos informativos del condominio." />

      <Card plana className="overflow-hidden">
        {cargando && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={FileText} title="Aún no hay documentos publicados" description="Cuando la administración publique uno, aparecerá aquí." />
        ) : (
          <ListaDocumentos
            docs={data}
            marcarRecientes
            onAbrir={(doc) => abrirDocumento(doc.id).catch((err) => toast.error(mensajeError(err, "No se pudo abrir el documento.")))}
          />
        )}
      </Card>
    </div>
  );
}
