import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    recordatorioEnviado: { create: vi.fn() },
    cobroGastoComun: { findMany: vi.fn() },
    encomienda: { findMany: vi.fn() },
    usuario: { findMany: vi.fn() },
  },
}));
vi.mock("../notificaciones/notificaciones.service", () => ({ crearNotificacionesMasivas: vi.fn() }));

import { prisma } from "../../lib/prisma";
import { crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { enviarRecordatorios } from "./recordatorios.service";

const p = prisma as unknown as Record<string, Record<string, Mock>>;
const notificar = crearNotificacionesMasivas as unknown as Mock;

// 5 de octubre de 2026, 15:00 en Chile (UTC-3)
const AHORA = new Date("2026-10-05T18:00:00.000Z");
const HORA = 3600_000;

const claves = new Set<string>();
function duplicado() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "5" });
}

const cobro = (id: string, vence: string, pagado = 0) => ({
  id,
  departamentoId: "d-1",
  montoTotal: 100000,
  montoPagado: pagado,
  periodo: { anio: 2026, mes: 9, fechaVencimiento: new Date(`${vence}T00:00:00.000Z`) },
});

beforeEach(() => {
  vi.clearAllMocks();
  claves.clear();
  p.recordatorioEnviado.create.mockImplementation(async ({ data }: { data: { clave: string } }) => {
    if (claves.has(data.clave)) throw duplicado();
    claves.add(data.clave);
    return { id: data.clave };
  });
  p.cobroGastoComun.findMany.mockResolvedValue([]);
  p.encomienda.findMany.mockResolvedValue([]);
  p.usuario.findMany.mockResolvedValue([{ id: "res-1" }]);
});

describe("enviarRecordatorios", () => {
  it("de noche no envia nada (los avisos esperan a las 9:00)", async () => {
    const r = await enviarRecordatorios(new Date("2026-10-05T06:00:00.000Z")); // 03:00 en Chile
    expect(r.enHorario).toBe(false);
    expect(p.cobroGastoComun.findMany).not.toHaveBeenCalled();
    expect(notificar).not.toHaveBeenCalled();
  });

  it("avisa una sola vez del gasto comun por vencer, con cuanto falta y el saldo", async () => {
    p.cobroGastoComun.findMany.mockResolvedValueOnce([cobro("c-1", "2026-10-07", 20000)]).mockResolvedValue([]);
    const r = await enviarRecordatorios(AHORA);
    expect(r.gastoPorVencer).toBe(1);
    expect(notificar.mock.calls[0][1]).toMatchObject({ titulo: "Gasto común por vencer", entidadTipo: "CobroGastoComun", entidadId: "c-1" });
    expect(notificar.mock.calls[0][1].mensaje).toMatch(/vence en 2 días \(7 de octubre\)\. Saldo: \$80\.000/);

    // segunda vuelta (o dos a la vez): la clave ya existe, no se repite el aviso
    p.cobroGastoComun.findMany.mockResolvedValueOnce([cobro("c-1", "2026-10-07", 20000)]).mockResolvedValue([]);
    const r2 = await enviarRecordatorios(new Date(AHORA.getTime() + HORA));
    expect(r2.gastoPorVencer).toBe(0);
    expect(notificar).toHaveBeenCalledTimes(1);
  });

  it("avisa el gasto comun vencido y sugiere informar el pago", async () => {
    p.cobroGastoComun.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([cobro("c-2", "2026-10-01")]);
    const r = await enviarRecordatorios(AHORA);
    expect(r.gastoVencido).toBe(1);
    expect(notificar.mock.calls[0][1].titulo).toBe("Gasto común vencido");
    expect(notificar.mock.calls[0][1].mensaje).toMatch(/informa tu pago con el comprobante/);
  });

  it("encomiendas: a las 48 h un aviso y a las 72 h otro; si ya pasaron las 72 h, solo el segundo", async () => {
    const encomienda = (id: string, horas: number) => ({
      id,
      usuarioId: "res-1",
      remitente: "Starken",
      ubicacion: "Estante B",
      fechaRecepcion: new Date(AHORA.getTime() - horas * HORA),
    });
    p.encomienda.findMany.mockResolvedValue([encomienda("e-1", 50), encomienda("e-2", 80)]);
    const r = await enviarRecordatorios(AHORA);
    expect(r.encomiendas).toBe(2);
    expect(notificar.mock.calls[0][1].mensaje).toBe("Tu encomienda de Starken lleva más de 2 días en conserjería (Estante B). Pasa a retirarla cuando puedas.");
    expect(notificar.mock.calls[1][1].titulo).toBe("Encomienda sin retirar hace más de 3 días");
    expect(claves.has("encomienda-48h:e-2")).toBe(true); // reservada para no mandarla despues

    // la e-1 llega a las 72 h: ahora si recibe el segundo aviso; nada se repite
    notificar.mockClear();
    p.encomienda.findMany.mockResolvedValue([encomienda("e-1", 73), encomienda("e-2", 103)]);
    const r2 = await enviarRecordatorios(AHORA);
    expect(r2.encomiendas).toBe(1);
    expect(notificar.mock.calls[0][1]).toMatchObject({ entidadId: "e-1", titulo: "Encomienda sin retirar hace más de 3 días" });
  });
});
