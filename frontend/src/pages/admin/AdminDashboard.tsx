import { motion } from "framer-motion";
import { Buildings, CheckCircle, Clock, Megaphone, Package, QrCode, Siren, Warning } from "@phosphor-icons/react";
import { dashboardApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import {
  Card,
  CardHeader,
  EmptyState,
  Spinner,
  Alert,
  Badge,
  StatCard,
  staggerFade,
  HorizontalBarChart,
  Meter,
} from "../../components/ui";
import { BotonHero, HeroBanner, saludoSegunHora } from "../../components/Inicio";
import { formatFechaHora } from "../../lib/format";
import { RESULTADO_ACCESO_LABEL } from "../../lib/badges";

// Paleta de estado (dataviz skill): good/warning/serious reservados para semantica
// de sanciones; nunca reutilizados como color de serie generico.
const COLOR_MULTA: Record<string, string> = {
  PENDIENTE: "#fab219", // warning
  PAGADA: "#0ca30c", // good
  APELADA: "#ec835a", // serious
  ANULADA: "#898781", // muted (estado inactivo)
};

// Incidencias es una progresion ordinal (reportada -> resuelta): un solo hue,
// mas oscuro = mas avanzado, tomado del ramp secuencial azul documentado.
const COLOR_INCIDENCIA: Record<string, string> = {
  REPORTADA: "#86b6ef",
  EN_REVISION: "#5598e7",
  EN_PROCESO: "#2a78d6",
  RESUELTA: "#1c5cab",
};

const LABEL_MULTA: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  APELADA: "Apelada",
  ANULADA: "Anulada",
};

const LABEL_INCIDENCIA: Record<string, string> = {
  REPORTADA: "Reportada",
  EN_REVISION: "En revisión",
  EN_PROCESO: "En proceso",
  RESUELTA: "Resuelta",
};

export default function AdminDashboard() {
  const { usuario } = useAuth();
  const { data, cargando, error } = useAsync(() => dashboardApi.indicadores(), []);

  if (cargando) return <Spinner />;
  if (error) return <Alert tone="red">{error}</Alert>;
  if (!data) return null;

  const totalAccesos = data.accesos.totalAutorizados + data.accesos.totalRechazados;

  return (
    <div className="space-y-6">
      <HeroBanner
        etiqueta={
          <>
            <Buildings size={13} weight="fill" aria-hidden /> {usuario?.condominio?.nombre ?? "Panel administrativo"}
          </>
        }
        titulo={`${saludoSegunHora()}, ${usuario?.nombre ?? ""}`}
        subtitulo="Así está tu condominio hoy. Indicadores generales."
      >
        <div className="flex flex-wrap gap-2">
          <BotonHero to="/comunicados" icon={Megaphone} principal>
            Publicar comunicado
          </BotonHero>
          <BotonHero to="/multas" icon={Warning}>
            Registrar multa
          </BotonHero>
          <BotonHero to="/alertas-sos" icon={Siren}>
            Alertas SOS
          </BotonHero>
        </div>
      </HeroBanner>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Warning} label="Incidencias pendientes" value={data.incidencias.pendientes} tone="amber" index={0} />
        <StatCard icon={CheckCircle} label="Incidencias resueltas" value={data.incidencias.resueltas} tone="green" index={1} />
        <StatCard icon={Clock} label="Reservas próximas" value={data.reservas.proximas} tone="brand" index={2} />
        <StatCard icon={Package} label="Encomiendas por retirar" value={data.encomiendas.pendientesDeRetiro} tone="purple" index={3} />
        <StatCard icon={QrCode} label="Accesos autorizados (últ. 10)" value={data.accesos.autorizadosUltimos10} tone="green" index={4} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Multas por estado" />
          <HorizontalBarChart
            items={Object.entries(data.multas).map(([estado, cantidad]) => ({
              label: LABEL_MULTA[estado] ?? estado,
              value: cantidad,
              color: COLOR_MULTA[estado] ?? "#898781",
            }))}
          />
        </Card>

        <Card>
          <CardHeader title="Incidencias por estado" subtitle="Progreso de reportada a resuelta" />
          <HorizontalBarChart
            items={Object.entries(data.incidencias.porEstado).map(([estado, cantidad]) => ({
              label: LABEL_INCIDENCIA[estado] ?? estado,
              value: cantidad,
              color: COLOR_INCIDENCIA[estado] ?? "#2a78d6",
            }))}
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="Accesos por resultado" subtitle="Histórico completo de validaciones QR" />
        {totalAccesos === 0 ? (
          <EmptyState icon={QrCode} title="Aún no hay accesos registrados" />
        ) : (
          <Meter label="Accesos autorizados" value={data.accesos.totalAutorizados} total={totalAccesos} color="#0ca30c" />
        )}
      </Card>

      <Card>
        <CardHeader title="Accesos recientes" subtitle="Últimos 10 registros de validación QR" />
        {data.accesos.recientes.length === 0 ? (
          <EmptyState icon={QrCode} title="Sin accesos registrados" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {data.accesos.recientes.map((a, i) => (
              <motion.div key={a.id} {...staggerFade(i)} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{a.motivo}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Validado por {a.validadoPor.nombre} {a.validadoPor.apellido} · {formatFechaHora(a.createdAt)}
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
