import {
  CalendarCheck,
  CaretRight,
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
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { comunicadosApi, encomiendasApi, gastosComunesApi, incidenciasApi, multasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Card, CardHeader, EmptyState, Spinner } from "../../components/ui";
import { Cifra } from "../../components/Cifra";
import { ItemComunicado } from "../../components/Comunicados";
import { AccesoRapido, ChipHero, HeroBanner, saludoSegunHora } from "../../components/Inicio";
import { formatMonto } from "../../lib/format";

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

      {cargando && !(multas && incidencias && encomiendas && comunicados && cuenta) ? (
        <Spinner />
      ) : (
        <>
          <Card plana className="overflow-hidden">
            <CardHeader nivel={2} title="Tu resumen" subtitle="Toca una cifra para ver el detalle." />
            <div className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4 dark:bg-slate-700/60">
              <Cifra
                to="/gastos-comunes"
                icono={Wallet}
                etiqueta="Gasto común"
                valor={saldoGastoComun > 0 ? formatMonto(saldoGastoComun) : 0}
                detalle={gastoComunVencido > 0 ? `${formatMonto(gastoComunVencido)} vencido` : saldoGastoComun > 0 ? "por pagar" : "al día"}
                alerta={gastoComunVencido > 0}
              />
              <Cifra to="/multas" icono={Warning} etiqueta="Multas" valor={multasPendientes} detalle={multasPendientes === 1 ? "pendiente" : "pendientes"} />
              <Cifra
                to="/incidencias"
                icono={Wrench}
                etiqueta="Incidencias"
                valor={incidenciasAbiertas}
                detalle={incidenciasAbiertas === 1 ? "abierta" : "abiertas"}
              />
              <Cifra
                to="/encomiendas"
                icono={Package}
                etiqueta="Encomiendas"
                valor={encomiendasPorRetirar}
                detalle="por retirar"
              />
            </div>
          </Card>

          <Card plana className="overflow-hidden">
            <CardHeader
              nivel={2}
              title="Últimos comunicados"
              subtitle="Avisos de la administración"
              action={
                <Link
                  to="/comunicados"
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:min-h-0 dark:text-brand-400"
                >
                  Ver todos <CaretRight size={14} aria-hidden />
                </Link>
              }
            />
            {!comunicados?.length ? (
              <EmptyState icon={Megaphone} title="Sin comunicados recientes" />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {comunicados.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <ItemComunicado comunicado={c} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
