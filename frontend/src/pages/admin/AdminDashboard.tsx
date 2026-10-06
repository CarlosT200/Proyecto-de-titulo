import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import {
  ArrowClockwise,
  Buildings,
  CalendarCheck,
  CaretRight,
  ChartBar,
  CheckCircle,
  Gavel,
  Hourglass,
  Icon as PhosphorIcon,
  Megaphone,
  Package,
  QrCode,
  Siren,
  Wallet,
  Warning,
  UserPlus,
  Wrench,
} from "@phosphor-icons/react";
import { dashboardApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { Button, Card, CardHeader, EmptyState, Spinner, Alert, Badge, HorizontalBarChart } from "../../components/ui";
import { BotonHero, HeroBanner, RequiereAtencion, saludoSegunHora } from "../../components/Inicio";
import { formatFechaHora, formatMonto } from "../../lib/format";
import { RESULTADO_ACCESO_LABEL } from "../../lib/badges";
import { duracionLegible } from "../../lib/tiempo";
import { ENCOMIENDA_ATRASADA_HORAS } from "../../lib/umbrales";

// Colores de los graficos tomados de DESIGN.md (no valores sueltos): los de estado solo donde el
// estado significa algo (pendiente = advertencia, pagada = exito, apelada = atencion en naranja de
// marca, anulada = gris inactivo).
const COLOR_MULTA: Record<string, string> = {
  PENDIENTE: "#d97706", // advertencia
  PAGADA: "#059669", // exito
  APELADA: "#ea580c", // naranja de marca: requiere atencion
  ANULADA: "#94a3b8", // inactiva
};

// Incidencias es una progresion (reportada -> resuelta): un solo tono, el azul de la marca,
// mas oscuro = mas avanzada.
const COLOR_INCIDENCIA: Record<string, string> = {
  REPORTADA: "#93c5fd",
  EN_REVISION: "#60a5fa",
  EN_PROCESO: "#2563eb",
  RESUELTA: "#1e40af",
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

// Cuenta las veces que cambio un valor despues del primer pintado (para reproducir el destello).
function usePulsoAlCambiar(valor: string | number): number {
  const previo = useRef(valor);
  const [pulso, setPulso] = useState(0);
  useEffect(() => {
    if (previo.current !== valor) {
      previo.current = valor;
      setPulso((p) => p + 1);
    }
  }, [valor]);
  return pulso;
}

// Una cifra del panel dentro de un grupo. Toda la celda es un enlace a la lista ya filtrada (si hay
// a donde ir). Un cero se muestra atenuado para que destaque solo lo que tiene valor; "alerta"
// pinta la cifra en rojo cuando el valor es un problema (ej. una SOS activa).
function Cifra({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  to,
  alerta = false,
}: {
  icono: PhosphorIcon;
  etiqueta: string;
  valor: string | number;
  detalle?: ReactNode;
  to?: string;
  alerta?: boolean;
}) {
  const vacio = valor === 0 || valor === "Sin datos";
  const pulso = usePulsoAlCambiar(valor);
  const contenido = (
    <>
      {/* Si la cifra cambia con la actualizacion automatica, la celda se ilumina y se apaga (1,2 s):
          indica que algo cambio sin mover nada. Con "reducir movimiento" no se anima. */}
      {pulso > 0 && (
        <span
          key={pulso}
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-cifra-cambio bg-brand-500/10 dark:bg-brand-400/15"
        />
      )}
      <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
        <Icono size={16} className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
        <span className="min-w-0 flex-1">{etiqueta}</span>
        {to && (
          <CaretRight
            size={14}
            className="shrink-0 text-slate-400 transition-transform duration-150 ease-salida dark:text-slate-500 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </span>
      <span
        // Un monto largo (ej. "$3.176.250") se achica segun el ancho de la celda (unidades cqi): a
        // 320 px llegaba al borde.
        style={typeof valor === "string" && valor.length > 6 ? { fontSize: `min(1.5rem, ${(100 / (valor.length * 0.62)).toFixed(1)}cqi)` } : undefined}
        className={clsx(
          "mt-1.5 block whitespace-nowrap font-display text-2xl font-bold tabular-nums tracking-tight",
          vacio
            ? "text-slate-500 dark:text-slate-400"
            : alerta
              ? "text-red-600 dark:text-red-400"
              : "text-slate-900 dark:text-white"
        )}
      >
        {typeof valor === "number" ? valor.toLocaleString("es-CL") : valor}
      </span>
      {detalle && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{detalle}</span>}
    </>
  );
  const clases = "relative block h-full bg-white px-4 py-4 [container-type:inline-size] dark:bg-slate-800 sm:px-5";
  return to ? (
    <Link
      to={to}
      className={clsx(
        clases,
        "group transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:hover:bg-slate-700/60"
      )}
    >
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

// Grupo de cifras en una sola tarjeta, separadas por lineas finas (en vez de una tarjeta por cifra).
function GrupoCifras({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <Card plana className="overflow-hidden">
      <CardHeader nivel={2} title={titulo} subtitle={subtitulo} />
      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4 xl:grid-cols-2 dark:bg-slate-700/60">{children}</div>
    </Card>
  );
}

function SinDatos({ icono: Icono, texto }: { icono: PhosphorIcon; texto: string }) {
  return (
    <p className="flex items-center gap-2 px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
      <Icono size={18} className="shrink-0" aria-hidden />
      {texto}
    </p>
  );
}

function fechaDeHoy(): string {
  const texto = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function AdminDashboard() {
  const { usuario } = useAuth();
  const { data, cargando, error, setData, recargar } = useAsync(() => dashboardApi.indicadores(), []);

  // Se actualiza solo cada 30 segundos (sin parpadear) para que "Requiere atención" este al dia.
  useEffect(() => {
    const intervalo = setInterval(() => {
      dashboardApi.indicadores().then(setData).catch(() => {});
    }, 30000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cargando && !data) return <Spinner />;
  if (error && !data)
    return (
      <div className="space-y-3">
        <Alert tone="red">{error}</Alert>
        <Button variant="secondary" onClick={recargar}>
          <ArrowClockwise size={16} aria-hidden /> Reintentar
        </Button>
      </div>
    );
  if (!data) return null;

  const promedio = data.incidencias.promedioHorasResolucion;

  return (
    <div className="space-y-6">
      <HeroBanner
        compacto
        etiqueta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <Buildings size={14} weight="fill" aria-hidden /> {usuario?.condominio?.nombre ?? "Panel administrativo"}
            </span>
            {/* La fecha siempre en su propia linea: en una sola, con un nombre de condominio largo
                (o a 1280 px con los botones al lado) se partia y el separador quedaba colgando. */}
            <span className="basis-full">{fechaDeHoy()}</span>
          </>
        }
        titulo={`${saludoSegunHora()}, ${usuario?.nombre ?? ""}`}
      >
        {/* En celular: la accion principal a todo el ancho y las otras dos lado a lado (antes eran
            tres filas y el saludo ocupaba casi media pantalla). */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <BotonHero to="/comunicados" icon={Megaphone} principal className="col-span-2 justify-center">
            Publicar comunicado
          </BotonHero>
          {/* Tareas reales de la administracion. Las alertas SOS ya estan en "Requiere atencion",
              en "Dia a dia" y en el menu, asi que no se repiten aqui. */}
          <BotonHero to="/gastos-comunes" icon={Wallet} className="justify-center text-center leading-tight max-[359px]:col-span-2">
            Emitir cobro del mes
          </BotonHero>
          <BotonHero to="/residentes" icon={UserPlus} className="justify-center text-center leading-tight max-[359px]:col-span-2">
            Nuevo residente
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <GrupoCifras titulo="Día a día" subtitulo="Portería, accesos y espacios comunes">
          <Cifra
            icono={Siren}
            etiqueta="Alertas SOS activas"
            valor={data.sos.activas}
            alerta
            to="/alertas-sos?estado=ACTIVA"
          />
          <Cifra
            icono={Package}
            etiqueta="Encomiendas por retirar"
            valor={data.encomiendas.pendientesDeRetiro}
            detalle={
              data.encomiendas.atrasadas > 0
                ? `${data.encomiendas.atrasadas} con más de ${ENCOMIENDA_ATRASADA_HORAS} h`
                : undefined
            }
            to="/encomiendas?estado=NOTIFICADA"
          />
          <Cifra
            icono={QrCode}
            etiqueta="Accesos de hoy"
            valor={data.accesos.hoyAutorizados + data.accesos.hoyRechazados}
            detalle={
              data.accesos.hoyAutorizados + data.accesos.hoyRechazados > 0
                ? `${data.accesos.hoyAutorizados} ${data.accesos.hoyAutorizados === 1 ? "autorizado" : "autorizados"} · ${data.accesos.hoyRechazados} ${data.accesos.hoyRechazados === 1 ? "rechazado" : "rechazados"}`
                : undefined
            }
            to="/accesos?periodo=hoy"
          />
          <Cifra icono={CalendarCheck} etiqueta="Reservas próximas" valor={data.reservas.proximas} to="/reservas" />
        </GrupoCifras>

        <GrupoCifras titulo="Gestión" subtitulo="Incidencias y gastos comunes">
          <Cifra
            icono={Warning}
            etiqueta="Incidencias abiertas"
            valor={data.incidencias.pendientes}
            detalle={
              data.atencion.incidenciasUrgentes > 0
                ? `${data.atencion.incidenciasUrgentes} ${data.atencion.incidenciasUrgentes === 1 ? "urgente" : "urgentes"}`
                : undefined
            }
            to="/incidencias?estado=ABIERTAS"
          />
          <Cifra
            icono={CheckCircle}
            etiqueta="Incidencias resueltas"
            valor={data.incidencias.resueltas}
            to="/incidencias?estado=RESUELTA"
          />
          <Cifra
            icono={Hourglass}
            etiqueta="Tiempo promedio de resolución"
            valor={promedio === null ? "Sin datos" : duracionLegible(promedio)}
            detalle={promedio === null ? "Aparece al resolver la primera incidencia" : undefined}
          />
          <Cifra
            icono={Wallet}
            etiqueta="Gastos comunes vencidos"
            valor={data.gastosComunes.deudaVencida === 0 ? 0 : formatMonto(data.gastosComunes.deudaVencida)}
            detalle={
              data.gastosComunes.unidadesMorosas > 0
                ? `${data.gastosComunes.unidadesMorosas} ${data.gastosComunes.unidadesMorosas === 1 ? "unidad atrasada" : "unidades atrasadas"}`
                : undefined
            }
            alerta
            to="/gastos-comunes?vista=atrasadas"
          />
        </GrupoCifras>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card plana>
          <CardHeader nivel={2} title="Multas por estado" />
          {Object.values(data.multas).every((n) => n === 0) ? (
            <SinDatos icono={Gavel} texto="Aún no hay multas registradas." />
          ) : (
            <HorizontalBarChart
              items={Object.entries(data.multas).map(([estado, cantidad]) => ({
                label: LABEL_MULTA[estado] ?? estado,
                value: cantidad,
                color: COLOR_MULTA[estado] ?? "#94a3b8",
              }))}
            />
          )}
        </Card>

        <Card plana>
          <CardHeader nivel={2} title="Incidencias por estado" subtitle="Progreso de reportada a resuelta" />
          {Object.values(data.incidencias.porEstado).every((n) => n === 0) ? (
            <SinDatos icono={ChartBar} texto="Aún no hay incidencias reportadas." />
          ) : (
            <HorizontalBarChart
              items={Object.entries(data.incidencias.porEstado).map(([estado, cantidad]) => ({
                label: LABEL_INCIDENCIA[estado] ?? estado,
                value: cantidad,
                color: COLOR_INCIDENCIA[estado] ?? "#2563eb",
              }))}
            />
          )}
        </Card>
      </div>

      <Card plana>
        <CardHeader
          nivel={2}
          title="Últimos accesos"
          subtitle="Validaciones de códigos QR en portería"
          action={
            <Link
              to="/accesos"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:min-h-11 dark:text-brand-400"
            >
              Ver todo <CaretRight size={14} aria-hidden />
            </Link>
          }
        />
        {data.accesos.recientes.length === 0 ? (
          <EmptyState icon={QrCode} title="Sin accesos registrados" />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {data.accesos.recientes.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-700 dark:text-slate-200">{a.motivo}</p>
                  <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatFechaHora(a.createdAt)} · {a.validadoPor.nombre} {a.validadoPor.apellido}
                  </p>
                </div>
                <Badge tone={a.resultado === "AUTORIZADO" ? "green" : "red"}>{RESULTADO_ACCESO_LABEL[a.resultado]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
