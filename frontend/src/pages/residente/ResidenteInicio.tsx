import { motion } from "framer-motion";
import {
  CalendarCheck,
  CheckCircle,
  FileText,
  IdentificationBadge,
  MapPin,
  Megaphone,
  Package,
  Wallet,
  Warning,
  Wrench,
} from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";
import { comunicadosApi, encomiendasApi, gastosComunesApi, incidenciasApi, multasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Badge, Card, CardHeader, EmptyState, Spinner, StatCard, staggerFade } from "../../components/ui";
import { AccesoRapido, ChipHero, HeroBanner, saludoSegunHora } from "../../components/Inicio";
import { formatFechaHora, formatMonto } from "../../lib/format";
import { TIPO_COMUNICADO_LABEL } from "../../lib/badges";

export default function ResidenteInicio() {
  const { usuario } = useAuth();
  const { data: multas, cargando: cargandoMultas } = useAsync(() => multasApi.mias(), []);
  const { data: incidencias, cargando: cargandoIncidencias } = useAsync(() => incidenciasApi.mias(), []);
  const { data: encomiendas, cargando: cargandoEncomiendas } = useAsync(() => encomiendasApi.mias(), []);
  const { data: comunicados, cargando: cargandoComunicados } = useAsync(() => comunicadosApi.listar(), []);
  const { data: cuenta, cargando: cargandoCuenta } = useAsync(() => gastosComunesApi.miCuenta(), []);

  const multasPendientes = multas?.filter((m) => m.estado === "PENDIENTE").length ?? 0;
  const incidenciasAbiertas = incidencias?.filter((i) => i.estado !== "RESUELTA").length ?? 0;
  const encomiendasPorRetirar = encomiendas?.filter((e) => e.estado === "NOTIFICADA").length ?? 0;
  const saldoGastoComun = cuenta?.saldoPendiente ?? 0;
  const gastoComunVencido = cuenta?.deudaVencida ?? 0;

  const cargando = cargandoMultas || cargandoIncidencias || cargandoEncomiendas || cargandoComunicados || cargandoCuenta;

  const unidad = usuario?.departamento
    ? `${usuario.departamento.torre?.nombre ?? ""} ${usuario.departamento.numero}`.trim()
    : null;
  const etiqueta = [unidad, usuario?.condominio?.nombre].filter(Boolean).join(" · ");
  const todoAlDia = encomiendasPorRetirar === 0 && multasPendientes === 0 && saldoGastoComun === 0;

  return (
    <div className="space-y-6">
      <HeroBanner
        etiqueta={
          etiqueta ? (
            <>
              <MapPin size={13} weight="fill" aria-hidden /> {etiqueta}
            </>
          ) : undefined
        }
        titulo={`${saludoSegunHora()}, ${usuario?.nombre ?? ""}`}
        subtitulo="Esto es lo que pasa en tu condominio hoy."
      >
        {!cargando && (
          <div className="flex flex-wrap gap-2">
            {encomiendasPorRetirar > 0 && (
              <ChipHero icon={Package} to="/encomiendas">
                {encomiendasPorRetirar === 1 ? "1 encomienda por retirar" : `${encomiendasPorRetirar} encomiendas por retirar`}
              </ChipHero>
            )}
            {gastoComunVencido > 0 ? (
              <ChipHero icon={Wallet} to="/gastos-comunes">
                Gasto común vencido: {formatMonto(gastoComunVencido)}
              </ChipHero>
            ) : (
              saldoGastoComun > 0 && (
                <ChipHero icon={Wallet} to="/gastos-comunes">
                  Gasto común por pagar: {formatMonto(saldoGastoComun)}
                </ChipHero>
              )
            )}
            {multasPendientes > 0 && (
              <ChipHero icon={Warning} to="/multas">
                {multasPendientes === 1 ? "1 multa pendiente" : `${multasPendientes} multas pendientes`}
              </ChipHero>
            )}
            {todoAlDia && <ChipHero icon={CheckCircle}>Todo al día</ChipHero>}
          </div>
        )}
      </HeroBanner>

      <section aria-label="Accesos rápidos" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <AccesoRapido to="/qr" icon={IdentificationBadge} titulo="Mi credencial" descripcion="QR e invitados" tono="brand" index={0} />
        <AccesoRapido to="/reservas" icon={CalendarCheck} titulo="Reservar" descripcion="Espacios comunes" tono="green" index={1} />
        <AccesoRapido to="/incidencias" icon={Wrench} titulo="Reportar" descripcion="Un problema" tono="amber" index={2} />
        <AccesoRapido to="/documentos" icon={FileText} titulo="Documentos" descripcion="Reglamentos" tono="purple" index={3} />
      </section>

      {cargando ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              to="/gastos-comunes"
              icon={Wallet}
              label="Gastos comunes por pagar"
              value={0}
              valorTexto={formatMonto(saldoGastoComun)}
              tone={gastoComunVencido > 0 ? "red" : saldoGastoComun > 0 ? "brand" : "green"}
              index={0}
            />
            <StatCard to="/multas" icon={Warning} label="Multas pendientes" value={multasPendientes} tone="amber" index={1} />
            <StatCard to="/incidencias" icon={Wrench} label="Incidencias abiertas" value={incidenciasAbiertas} tone="brand" index={2} />
            <StatCard to="/encomiendas" icon={Package} label="Encomiendas por retirar" value={encomiendasPorRetirar} tone="purple" index={3} />
          </div>

          <Card>
            <CardHeader title="Últimos comunicados" subtitle="Avisos de la administración" />
            {!comunicados?.length ? (
              <EmptyState icon={Megaphone} title="Sin comunicados recientes" />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {comunicados.slice(0, 5).map((c, i) => (
                  <motion.div key={c.id} {...staggerFade(i)} className="flex gap-3 px-5 py-4">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                      <Megaphone size={18} weight="duotone" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.titulo}</p>
                        <Badge tone="blue">{TIPO_COMUNICADO_LABEL[c.tipo]}</Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{c.contenido}</p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{formatFechaHora(c.createdAt)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
