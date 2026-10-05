import { Package } from "@phosphor-icons/react";
import { encomiendasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { PageHeader } from "../../components/ui";
import { ListaEncomiendas } from "../../components/Encomiendas";

// La administracion consulta; la entrega y la devolucion las registra conserjeria.
export default function AdminEncomiendas() {
  const { data, cargando, error, recargar } = useAsync(() => encomiendasApi.listarTodas(), []);

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Encomiendas" subtitle="Registro completo de encomiendas del condominio." />
      <ListaEncomiendas data={data} cargando={cargando} error={error} puedeGestionar={false} onActualizada={recargar} />
    </div>
  );
}
