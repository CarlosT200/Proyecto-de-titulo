import {
  EstadoAlertaSos,
  EstadoEncomienda,
  EstadoIncidencia,
  EstadoMulta,
  EstadoReserva,
  PrioridadIncidencia,
  ResultadoAcceso,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ahoraEnChile, inicioDelDiaEnChile } from "../../lib/fechas";
import { ENCOMIENDA_ATRASADA_HORAS, HORA_MS } from "../../lib/umbrales";
import { hoyEnChile } from "../../lib/gastosComunes";
import { listarAccesos } from "../qr/qr.service";
import { listarAlertasActivas } from "../sos/sos.service";

const ESTADOS_ABIERTOS = [EstadoIncidencia.REPORTADA, EstadoIncidencia.EN_REVISION, EstadoIncidencia.EN_PROCESO];

// Reservas que todavia no terminan: dias posteriores a hoy, o de hoy cuya hora de termino no llega.
// (Antes se comparaba la fecha con "ahora" y las reservas de hoy quedaban fuera.)
export function filtroReservasProximas(instante: Date = new Date()) {
  const { fecha, hora } = ahoraEnChile(instante);
  const hoy = new Date(`${fecha}T00:00:00.000Z`);
  return {
    estado: EstadoReserva.CONFIRMADA,
    OR: [{ fecha: { gt: hoy } }, { fecha: hoy, horaFin: { gt: hora } }],
  };
}

// Promedio, en horas, entre que se reporta una incidencia y la primera vez que se marca resuelta.
export function promedioHorasResolucion(
  incidencias: { createdAt: Date; historial: { createdAt: Date }[] }[]
): number | null {
  const duraciones = incidencias
    .filter((i) => i.historial.length > 0)
    .map((i) => (i.historial[0].createdAt.getTime() - i.createdAt.getTime()) / HORA_MS)
    .filter((horas) => horas >= 0);
  if (duraciones.length === 0) return null;
  const promedio = duraciones.reduce((a, b) => a + b, 0) / duraciones.length;
  return Math.round(promedio * 10) / 10;
}

function limiteEncomiendaAtrasada(instante: Date): Date {
  return new Date(instante.getTime() - ENCOMIENDA_ATRASADA_HORAS * HORA_MS);
}

// HU-24: indicadores del condominio para la administracion, con lo que requiere atencion primero.
export async function obtenerIndicadores(condominioId: string, instante: Date = new Date()) {
  const inicioHoy = inicioDelDiaEnChile(instante);
  const cobrosVencidos = { condominioId, pagado: false, periodo: { fechaVencimiento: { lt: hoyEnChile(instante) } } };
  const [
    incidenciasPendientes,
    incidenciasResueltas,
    incidenciasPorEstado,
    incidenciasUrgentes,
    incidenciasSinRevisar,
    resueltasConHistorial,
    reservasProximas,
    multasPorEstado,
    encomiendasPendientes,
    encomiendasAtrasadas,
    sosActivas,
    accesosRecientes,
    accesosPorResultado,
    accesosHoyPorResultado,
    deudaVencida,
    unidadesMorosas,
  ] = await Promise.all([
    prisma.incidencia.count({ where: { condominioId, estado: { in: ESTADOS_ABIERTOS } } }),
    prisma.incidencia.count({ where: { condominioId, estado: EstadoIncidencia.RESUELTA } }),
    prisma.incidencia.groupBy({ by: ["estado"], where: { condominioId }, _count: { _all: true } }),
    prisma.incidencia.count({
      where: { condominioId, estado: { in: ESTADOS_ABIERTOS }, prioridad: PrioridadIncidencia.ALTA },
    }),
    prisma.incidencia.count({ where: { condominioId, estado: EstadoIncidencia.REPORTADA } }),
    prisma.incidencia.findMany({
      where: { condominioId, estado: EstadoIncidencia.RESUELTA },
      select: {
        createdAt: true,
        historial: {
          where: { estadoNuevo: EstadoIncidencia.RESUELTA },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.reserva.count({ where: { espacioComun: { condominioId }, ...filtroReservasProximas(instante) } }),
    prisma.multa.groupBy({ by: ["estado"], where: { condominioId }, _count: { _all: true } }),
    prisma.encomienda.count({ where: { condominioId, estado: EstadoEncomienda.NOTIFICADA } }),
    prisma.encomienda.count({
      where: { condominioId, estado: EstadoEncomienda.NOTIFICADA, fechaRecepcion: { lt: limiteEncomiendaAtrasada(instante) } },
    }),
    prisma.alertaSos.count({ where: { condominioId, estado: EstadoAlertaSos.ACTIVA } }),
    prisma.accesoLog.findMany({
      where: { condominioId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { validadoPor: { select: { nombre: true, apellido: true } } },
    }),
    prisma.accesoLog.groupBy({ by: ["resultado"], where: { condominioId }, _count: { _all: true } }),
    prisma.accesoLog.groupBy({
      by: ["resultado"],
      where: { condominioId, createdAt: { gte: inicioHoy } },
      _count: { _all: true },
    }),
    prisma.cobroGastoComun.aggregate({ where: cobrosVencidos, _sum: { montoTotal: true, montoPagado: true } }),
    prisma.cobroGastoComun.groupBy({ by: ["departamentoId"], where: cobrosVencidos }),
  ]);

  const multasPorEstadoMap = Object.fromEntries(
    Object.values(EstadoMulta).map((estado) => [estado, multasPorEstado.find((m) => m.estado === estado)?._count._all ?? 0])
  ) as Record<EstadoMulta, number>;

  const incidenciasPorEstadoMap = Object.fromEntries(
    Object.values(EstadoIncidencia).map((estado) => [
      estado,
      incidenciasPorEstado.find((i) => i.estado === estado)?._count._all ?? 0,
    ])
  );

  const contar = (grupos: { resultado: ResultadoAcceso; _count: { _all: number } }[], resultado: ResultadoAcceso) =>
    grupos.find((g) => g.resultado === resultado)?._count._all ?? 0;

  return {
    // Lo que alguien tiene que mirar ahora. El frontend muestra solo los que no estan en cero.
    atencion: {
      sosActivas,
      incidenciasUrgentes,
      incidenciasSinRevisar,
      multasApeladas: multasPorEstadoMap.APELADA,
      encomiendasAtrasadas,
      unidadesMorosas: unidadesMorosas.length,
    },
    incidencias: {
      pendientes: incidenciasPendientes,
      resueltas: incidenciasResueltas,
      porEstado: incidenciasPorEstadoMap,
      promedioHorasResolucion: promedioHorasResolucion(resueltasConHistorial),
    },
    reservas: { proximas: reservasProximas },
    multas: multasPorEstadoMap,
    encomiendas: { pendientesDeRetiro: encomiendasPendientes, atrasadas: encomiendasAtrasadas },
    sos: { activas: sosActivas },
    gastosComunes: {
      deudaVencida: (deudaVencida._sum.montoTotal ?? 0) - (deudaVencida._sum.montoPagado ?? 0),
      unidadesMorosas: unidadesMorosas.length,
    },
    accesos: {
      recientes: accesosRecientes,
      autorizadosUltimos10: accesosRecientes.filter((a) => a.resultado === ResultadoAcceso.AUTORIZADO).length,
      totalAutorizados: contar(accesosPorResultado, ResultadoAcceso.AUTORIZADO),
      totalRechazados: contar(accesosPorResultado, ResultadoAcceso.RECHAZADO),
      hoyAutorizados: contar(accesosHoyPorResultado, ResultadoAcceso.AUTORIZADO),
      hoyRechazados: contar(accesosHoyPorResultado, ResultadoAcceso.RECHAZADO),
    },
  };
}

// Inicio de conserjeria: lo del turno (emergencias, encomiendas por entregar y accesos de hoy).
export async function obtenerPanelConserjeria(condominioId: string, instante: Date = new Date()) {
  const inicioHoy = inicioDelDiaEnChile(instante);
  const [encomiendasPendientes, encomiendasAtrasadas, sosActivas, alertasActivas, accesosHoy, accesosRecientes] =
    await Promise.all([
      prisma.encomienda.count({ where: { condominioId, estado: EstadoEncomienda.NOTIFICADA } }),
      prisma.encomienda.count({
        where: { condominioId, estado: EstadoEncomienda.NOTIFICADA, fechaRecepcion: { lt: limiteEncomiendaAtrasada(instante) } },
      }),
      prisma.alertaSos.count({ where: { condominioId, estado: EstadoAlertaSos.ACTIVA } }),
      listarAlertasActivas(condominioId, 5),
      prisma.accesoLog.groupBy({
        by: ["resultado"],
        where: { condominioId, createdAt: { gte: inicioHoy } },
        _count: { _all: true },
      }),
      listarAccesos(condominioId, 5),
    ]);

  const contar = (resultado: ResultadoAcceso) => accesosHoy.find((g) => g.resultado === resultado)?._count._all ?? 0;

  return {
    encomiendas: { pendientes: encomiendasPendientes, atrasadas: encomiendasAtrasadas },
    sos: { activas: sosActivas, alertas: alertasActivas },
    accesos: {
      hoyAutorizados: contar(ResultadoAcceso.AUTORIZADO),
      hoyRechazados: contar(ResultadoAcceso.RECHAZADO),
      recientes: accesosRecientes,
    },
  };
}
