import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoReserva, ResultadoAcceso } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    incidencia: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    reserva: { count: vi.fn() },
    multa: { groupBy: vi.fn() },
    encomienda: { count: vi.fn() },
    alertaSos: { count: vi.fn(), findMany: vi.fn() },
    accesoLog: { findMany: vi.fn(), groupBy: vi.fn() },
    cobroGastoComun: { aggregate: vi.fn(), groupBy: vi.fn() },
    comprobantePago: { count: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma";
import { filtroReservasProximas, obtenerIndicadores, obtenerPanelConserjeria, promedioHorasResolucion } from "./dashboard.service";

const p = prisma as unknown as Record<string, Record<string, Mock>>;

beforeEach(() => {
  vi.clearAllMocks();
  p.incidencia.count.mockResolvedValue(0);
  p.incidencia.groupBy.mockResolvedValue([]);
  p.incidencia.findMany.mockResolvedValue([]);
  p.reserva.count.mockResolvedValue(0);
  p.multa.groupBy.mockResolvedValue([]);
  p.encomienda.count.mockResolvedValue(0);
  p.alertaSos.count.mockResolvedValue(0);
  p.alertaSos.findMany.mockResolvedValue([]);
  p.accesoLog.findMany.mockResolvedValue([]);
  p.accesoLog.groupBy.mockResolvedValue([]);
  p.cobroGastoComun.aggregate.mockResolvedValue({ _sum: { montoTotal: null, montoPagado: null } });
  p.cobroGastoComun.groupBy.mockResolvedValue([]);
  p.comprobantePago.count.mockResolvedValue(0);
});

describe("filtroReservasProximas", () => {
  it("incluye las reservas de hoy que aun no terminan (antes quedaban fuera)", () => {
    // 2026-10-04 15:30 en Chile
    const filtro = filtroReservasProximas(new Date("2026-10-04T18:30:00.000Z"));
    expect(filtro).toEqual({
      estado: EstadoReserva.CONFIRMADA,
      OR: [
        { fecha: { gt: new Date("2026-10-04T00:00:00.000Z") } },
        { fecha: new Date("2026-10-04T00:00:00.000Z"), horaFin: { gt: "15:30" } },
      ],
    });
  });

  it("usa el dia de Chile aunque en UTC ya sea el dia siguiente", () => {
    // 2026-10-05 01:00 UTC = 2026-10-04 22:00 en Chile
    const filtro = filtroReservasProximas(new Date("2026-10-05T01:00:00.000Z"));
    expect(filtro.OR[1]).toEqual({ fecha: new Date("2026-10-04T00:00:00.000Z"), horaFin: { gt: "22:00" } });
  });
});

describe("promedioHorasResolucion", () => {
  const inc = (creada: string, resuelta?: string) => ({
    createdAt: new Date(creada),
    historial: resuelta ? [{ createdAt: new Date(resuelta) }] : [],
  });

  it("promedia el tiempo entre el reporte y la primera vez que se resolvio", () => {
    expect(
      promedioHorasResolucion([
        inc("2026-10-01T10:00:00Z", "2026-10-01T16:00:00Z"), // 6 h
        inc("2026-10-02T10:00:00Z", "2026-10-03T10:00:00Z"), // 24 h
      ])
    ).toBe(15);
  });

  it("sin incidencias resueltas no inventa un numero", () => {
    expect(promedioHorasResolucion([])).toBeNull();
    expect(promedioHorasResolucion([inc("2026-10-01T10:00:00Z")])).toBeNull();
  });
});

describe("obtenerIndicadores: requiere atención", () => {
  it("cuenta urgentes, sin revisar, SOS activas, apelaciones y encomiendas de mas de 48 h", async () => {
    // orden de los count de incidencia: pendientes, resueltas, urgentes, sin revisar
    p.incidencia.count.mockResolvedValueOnce(5).mockResolvedValueOnce(9).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    p.multa.groupBy.mockResolvedValue([{ estado: "APELADA", _count: { _all: 1 } }]);
    p.encomienda.count.mockResolvedValueOnce(7).mockResolvedValueOnce(4); // pendientes, atrasadas
    p.alertaSos.count.mockResolvedValue(1);
    p.accesoLog.groupBy
      .mockResolvedValueOnce([{ resultado: ResultadoAcceso.AUTORIZADO, _count: { _all: 40 } }]) // historico
      .mockResolvedValueOnce([
        { resultado: ResultadoAcceso.AUTORIZADO, _count: { _all: 6 } },
        { resultado: ResultadoAcceso.RECHAZADO, _count: { _all: 2 } },
      ]); // hoy
    p.cobroGastoComun.aggregate.mockResolvedValue({ _sum: { montoTotal: 300000, montoPagado: 50000 } });
    p.cobroGastoComun.groupBy.mockResolvedValue([{ departamentoId: "d-1" }, { departamentoId: "d-2" }]);

    const ahora = new Date("2026-10-04T18:00:00.000Z");
    const r = await obtenerIndicadores("condo-1", ahora);

    expect(r.atencion).toEqual({
      sosActivas: 1,
      incidenciasUrgentes: 2,
      incidenciasSinRevisar: 3,
      multasApeladas: 1,
      encomiendasAtrasadas: 4,
      unidadesMorosas: 2,
      comprobantesPorRevisar: 0,
    });
    expect(r.gastosComunes).toEqual({ deudaVencida: 250000, unidadesMorosas: 2 });
    // vencido = sin pagar y con vencimiento anterior a hoy en Chile
    expect(p.cobroGastoComun.aggregate.mock.calls[0][0].where).toEqual({
      condominioId: "condo-1",
      pagado: false,
      periodo: { fechaVencimiento: { lt: new Date("2026-10-04T00:00:00.000Z") } },
    });
    expect(r.accesos.hoyAutorizados).toBe(6);
    expect(r.accesos.hoyRechazados).toBe(2);
    expect(r.encomiendas).toEqual({ pendientesDeRetiro: 7, atrasadas: 4 });

    // "de mas de 48 h" se calcula contra el instante dado
    const llamadaAtrasadas = p.encomienda.count.mock.calls[1][0];
    expect(llamadaAtrasadas.where.fechaRecepcion.lt).toEqual(new Date("2026-10-02T18:00:00.000Z"));
    // "hoy" empieza a las 00:00 de Chile
    expect(p.accesoLog.groupBy.mock.calls[1][0].where.createdAt.gte).toEqual(new Date("2026-10-04T03:00:00.000Z"));
    // todo se filtra por el condominio de la sesion
    for (const llamada of p.incidencia.count.mock.calls) expect(llamada[0].where.condominioId).toBe("condo-1");
  });
});

describe("obtenerPanelConserjeria", () => {
  it("entrega encomiendas pendientes y atrasadas, SOS activas y accesos de hoy", async () => {
    p.encomienda.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    p.alertaSos.count.mockResolvedValue(2);
    p.alertaSos.findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    p.accesoLog.groupBy.mockResolvedValue([{ resultado: ResultadoAcceso.RECHAZADO, _count: { _all: 1 } }]);

    const r = await obtenerPanelConserjeria("condo-1", new Date("2026-10-04T18:00:00.000Z"));

    expect(r.encomiendas).toEqual({ pendientes: 3, atrasadas: 1 });
    expect(r.sos.activas).toBe(2);
    expect(r.sos.alertas).toHaveLength(2);
    expect(r.accesos.hoyAutorizados).toBe(0);
    expect(r.accesos.hoyRechazados).toBe(1);
    expect(p.alertaSos.findMany.mock.calls[0][0].where).toEqual({ condominioId: "condo-1", estado: "ACTIVA" });
  });
});
