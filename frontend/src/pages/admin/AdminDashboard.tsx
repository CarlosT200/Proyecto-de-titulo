import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Buildings,
  CalendarCheck,
  CheckCircle,
  Gavel,
  Hourglass,
  Megaphone,
  Package,
  QrCode,
  Siren,
  Wallet,
  Warning,
  Wrench,
} from "@phosphor-icons/react";
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
import { BotonHero, HeroBanner, RequiereAtencion, saludoSegunHora } from "../../components/Inicio";
import { formatFechaHora } from "../../lib/format";
import { RESULTADO_ACCESO_LABEL } from "../../lib/badges";
import { duracionLegible } from "../../lib/tiempo";
import { ENCOMIENDA_ATRASADA_HORAS } from "../../lib/umbrales";

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
  const { data, cargando, error, setData } = useAsync(() => dashboardApi.indicadores(), []);

  // Se actualiza solo cada 30 segundos (sin parpadear) para que "Requiere atención" este al dia.
  useEffect(() => {
    const intervalo = setInterval(() => {
      dashboardApi.indicadores().then(setData).catch(() => {});
    }, 30000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cargando && !data) return <Spinner />;
  if (error && !data) return <Alert tone="red">{error}</Alert>;
  if (!data) return null;

  const promedio = data.incidencias.promedioHorasResolucion;

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

      <RequiereAtencion
        items={[
          {
            cantidad: data.atencion.sosActivas,
            singular: "alerta SOS activa",
            plural: "alertas SOS activas",
            to: "/alertas-sos?estado=ACTIVA",
            tono: "red",
            icono: Siren,
          },
          {
            cantidad: data.atencion.incidenciasUrgentes,
            singular: "incidencia urgente sin resolver",
            plural: "incidencias urgentes sin resolver",
            to: "/incidencias?estado=ABIERTAS&prioridad=ALTA",
            tono: "red",
            icono: Wrench,
          },
          {
            cantidad: data.atencion.incidenciasSinRevisar,
            singular: "incidencia nueva sin revisar",
            plural: "incidencias nuevas sin revisar",
            to: "/incidencias?estado=REPORTADA",
            tono: "amber",
            icono: Wrench,
          },
          {
            cantidad: data.atencion.multasApeladas,
            singular: "multa apelada por resolver",
            plural: "multas apeladas por resolver",
            to: "/multas?estado=APELADA",
            tono: "amber",
            icono: Gavel,
          },
          {
            cantidad: data.atencion.encomiendasAtrasadas,
            singular: `encomienda sin retirar hace más de ${ENCOMIENDA_ATRASADA_HORAS} horas`,
            plural: `encomiendas sin retirar hace más de ${ENCOMIENDA_ATRASADA_HORAS} horas`,
            to: "/encomiendas?estado=ATRASADA",
            tono: "amber",
            icono: Package,
          },
          {
            cantidad: data.atencion.unidadesMorosas,
            singular: "unidad con gastos comunes vencidos",
            plural: "unidades con gastos comunes vencidos",
            to: "/gastos-comunes?vista=atrasadas",
            tono: "amber",
            icono: Wallet,
          },
        ]}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard to="/incidencias?estado=ABIERTAS" icon={Warning} label="Incidencias abiertas" value={data.incidencias.pendientes} tone="amber" index={0} />
        <StatCard to="/incidencias?estado=RESUELTA" icon={CheckCircle} label="Incidencias resueltas" value={data.incidencias.resueltas} tone="green" index={1} />
        <StatCard
          icon={Hourglass}
          label="Tiempo promedio de resolución"
          value={0}
          valorTexto={promedio === null ? "Sin datos" : duracionLegible(promedio)}
          tone="slate"
          index={2}
        />
        <StatCard to="/reservas" icon={CalendarCheck} label="Reservas próximas" value={data.reservas.proximas} tone="brand" index={3} />
        <StatCard to="/encomiendas?estado=NOTIFICADA" icon={Package} label="Encomiendas por retirar" value={data.encomiendas.pendientesDeRetiro} tone="purple" index={4} />
        <StatCard to="/accesos?periodo=hoy" icon={QrCode} label="Accesos de hoy" value={data.accesos.hoyAutorizados + data.accesos.hoyRechazados} tone="green" index={5} />
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
