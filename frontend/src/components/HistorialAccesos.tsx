import { motion } from "framer-motion";
import { Icon as PhosphorIcon, QrCode } from "@phosphor-icons/react";
import { qrApi } from "../api/endpoints";
import { useAsync } from "../hooks/useAsync";
import { useFiltroUrl } from "../hooks/useFiltroUrl";
import { Alert, Badge, Card, EmptyState, Label, PageHeader, Select, Spinner, staggerFade } from "./ui";
import { DetalleAcceso } from "./DetalleAcceso";
import { formatFechaHora, hoyLocal } from "../lib/format";
import { RESULTADO_ACCESO_LABEL } from "../lib/badges";

const RESULTADOS = ["AUTORIZADO", "RECHAZADO"] as const;
const PERIODOS = ["hoy"] as const;

function esDeHoy(fechaISO: string): boolean {
  const d = new Date(fechaISO);
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return local === hoyLocal();
}

// Historial de validaciones de QR (administracion y conserjeria). Los filtros viajan en la direccion
// (?resultado=RECHAZADO&periodo=hoy) para que los paneles puedan enlazar a la lista ya filtrada.
export function HistorialAccesos({
  titulo,
  subtitulo,
  icono,
  mostrarValidador,
}: {
  titulo: string;
  subtitulo: string;
  icono: PhosphorIcon;
  mostrarValidador: boolean;
}) {
  const { data, cargando, error } = useAsync(() => qrApi.accesos(), []);
  const [resultado, setResultado] = useFiltroUrl("resultado", RESULTADOS);
  const [periodo, setPeriodo] = useFiltroUrl("periodo", PERIODOS);

  const filtrados = (data ?? []).filter(
    (a) => (!resultado || a.resultado === resultado) && (!periodo || esDeHoy(a.createdAt))
  );

  return (
    <div className="space-y-6">
      <PageHeader icon={icono} title={titulo} subtitle={subtitulo} />

      <div className="flex flex-wrap gap-3">
        <div className="w-full sm:w-48">
          <Label htmlFor="campo-accesos-resultado">Resultado</Label>
          <Select id="campo-accesos-resultado" value={resultado} onChange={(e) => setResultado(e.target.value as typeof resultado)}>
            <option value="">Todos</option>
            <option value="AUTORIZADO">Autorizados</option>
            <option value="RECHAZADO">Rechazados</option>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="campo-accesos-periodo">Período</Label>
          <Select id="campo-accesos-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)}>
            <option value="">Últimos 100 registros</option>
            <option value="hoy">Solo hoy</option>
          </Select>
        </div>
      </div>

      <Card>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={QrCode} title="Aún no hay accesos registrados" />
        ) : !filtrados.length ? (
          <EmptyState icon={QrCode} title="Sin resultados" description="Ningún acceso coincide con los filtros." />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {filtrados.map((a, i) => (
              <motion.div
                key={a.id}
                {...staggerFade(i)}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60"
              >
                <div className="min-w-0">
                  {a.detalle ? (
                    <DetalleAcceso detalle={a.detalle} />
                  ) : (
                    <p className="text-sm text-slate-700 dark:text-slate-300">{a.motivo}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {a.detalle && a.resultado === "RECHAZADO" ? `${a.motivo} · ` : ""}
                    {mostrarValidador ? `Validado por ${a.validadoPor.nombre} ${a.validadoPor.apellido} · ` : ""}
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
