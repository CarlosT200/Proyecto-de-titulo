import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoReserva } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    espacioComun: { findFirst: vi.fn() },
    reserva: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../../lib/prisma";
import { cancelarReserva, crearReserva } from "./reservas.service";

const findEspacio = prisma.espacioComun.findFirst as unknown as Mock;
const findReserva = prisma.reserva.findFirst as unknown as Mock;
const updateReserva = prisma.reserva.update as unknown as Mock;
const transaccion = prisma.$transaction as unknown as Mock;

const llamadas: string[] = [];

function crearTx(reservasExistentes: { horaInicio: string; horaFin: string }[] = []) {
  return {
    $executeRaw: vi.fn().mockImplementation(async () => {
      llamadas.push("candado");
      return 0;
    }),
    reserva: {
      findMany: vi.fn().mockImplementation(async () => {
        llamadas.push("consulta");
        return reservasExistentes;
      }),
      create: vi.fn().mockImplementation(async () => {
        llamadas.push("creacion");
        return { id: "reserva-1" };
      }),
    },
  };
}

const ESPACIO = { id: "espacio-1", nombre: "Quincho", horarioInicio: "08:00", horarioFin: "23:59" };

beforeEach(() => {
  vi.clearAllMocks();
  llamadas.length = 0;
  vi.useFakeTimers();
  findEspacio.mockResolvedValue(ESPACIO);
  // la transaccion ejecuta el callback con un "tx" sin reservas previas
  transaccion.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(crearTx()));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("crearReserva: no se reserva en el pasado", () => {
  it("rechaza una fecha anterior a hoy", async () => {
    vi.setSystemTime(new Date("2026-10-03T20:30:00.000Z")); // 17:30 en Chile
    await expect(
      crearReserva("condo-1", "u-1", { espacioComunId: "espacio-1", fecha: "2020-01-15", horaInicio: "10:00", horaFin: "11:00" })
    ).rejects.toThrow(/ya pasó/);
    expect(transaccion).not.toHaveBeenCalled();
  });

  it("rechaza un horario de hoy que ya empezó", async () => {
    vi.setSystemTime(new Date("2026-10-03T20:30:00.000Z")); // 17:30 en Chile
    await expect(
      crearReserva("condo-1", "u-1", { espacioComunId: "espacio-1", fecha: "2026-10-03", horaInicio: "10:00", horaFin: "11:00" })
    ).rejects.toThrow(/ya pasó/);
  });

  it("acepta un horario de hoy que todavía no llega", async () => {
    vi.setSystemTime(new Date("2026-10-03T20:30:00.000Z")); // 17:30 en Chile
    await expect(
      crearReserva("condo-1", "u-1", { espacioComunId: "espacio-1", fecha: "2026-10-03", horaInicio: "20:00", horaFin: "21:00" })
    ).resolves.toEqual({ id: "reserva-1" });
  });

  it("usa el dia de Chile: a las 22:30 locales (01:30 UTC del dia siguiente) todavia se puede reservar para hoy", async () => {
    vi.setSystemTime(new Date("2026-10-04T01:30:00.000Z")); // 22:30 del 3 de octubre en Chile
    await expect(
      crearReserva("condo-1", "u-1", { espacioComunId: "espacio-1", fecha: "2026-10-03", horaInicio: "23:00", horaFin: "23:30" })
    ).resolves.toEqual({ id: "reserva-1" });
  });
});

// RNF-10: no puede haber dos reservas del mismo espacio y horario.
describe("crearReserva: reservas duplicadas", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-10-03T20:30:00.000Z"));
  });

  it("toma el candado del espacio y dia ANTES de revisar si el horario esta libre", async () => {
    await crearReserva("condo-1", "u-1", { espacioComunId: "espacio-1", fecha: "2026-10-10", horaInicio: "10:00", horaFin: "11:00" });
    expect(llamadas).toEqual(["candado", "consulta", "creacion"]);
  });

  it("rechaza un horario que se superpone con una reserva confirmada", async () => {
    transaccion.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(crearTx([{ horaInicio: "10:30", horaFin: "11:30" }])));
    await expect(
      crearReserva("condo-1", "u-1", { espacioComunId: "espacio-1", fecha: "2026-10-10", horaInicio: "10:00", horaFin: "11:00" })
    ).rejects.toThrow(/ya se encuentra reservado/);
    expect(llamadas).not.toContain("creacion");
  });

  it("acepta horarios contiguos (uno termina cuando empieza el otro)", async () => {
    transaccion.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(crearTx([{ horaInicio: "09:00", horaFin: "10:00" }])));
    await expect(
      crearReserva("condo-1", "u-1", { espacioComunId: "espacio-1", fecha: "2026-10-10", horaInicio: "10:00", horaFin: "11:00" })
    ).resolves.toEqual({ id: "reserva-1" });
  });
});

describe("cancelarReserva", () => {
  const reserva = (extra: Record<string, unknown> = {}) => ({
    id: "reserva-1",
    usuarioId: "u-1",
    estado: EstadoReserva.CONFIRMADA,
    fecha: new Date("2026-10-10T00:00:00.000Z"),
    horaInicio: "10:00",
    horaFin: "12:00",
    ...extra,
  });

  beforeEach(() => {
    vi.setSystemTime(new Date("2026-10-03T20:30:00.000Z"));
    updateReserva.mockResolvedValue({ id: "reserva-1", estado: EstadoReserva.CANCELADA });
  });

  it("cancela una reserva futura propia", async () => {
    findReserva.mockResolvedValue(reserva());
    await cancelarReserva("condo-1", "u-1", false, "reserva-1");
    expect(updateReserva).toHaveBeenCalledWith(expect.objectContaining({ data: { estado: EstadoReserva.CANCELADA } }));
  });

  it("no deja cancelar una reserva que ya finalizó", async () => {
    findReserva.mockResolvedValue(reserva({ fecha: new Date("2026-09-24T00:00:00.000Z") }));
    await expect(cancelarReserva("condo-1", "u-1", false, "reserva-1")).rejects.toThrow(/ya finalizó/);
    expect(updateReserva).not.toHaveBeenCalled();
  });

  it("no deja cancelar dos veces la misma reserva", async () => {
    findReserva.mockResolvedValue(reserva({ estado: EstadoReserva.CANCELADA }));
    await expect(cancelarReserva("condo-1", "u-1", false, "reserva-1")).rejects.toThrow(/ya estaba cancelada/);
  });

  it("un residente no puede cancelar la reserva de otro, pero el administrador sí", async () => {
    findReserva.mockResolvedValue(reserva({ usuarioId: "otro" }));
    await expect(cancelarReserva("condo-1", "u-1", false, "reserva-1")).rejects.toThrow(/tus propias reservas/);
    await expect(cancelarReserva("condo-1", "admin-1", true, "reserva-1")).resolves.toBeTruthy();
  });
});
