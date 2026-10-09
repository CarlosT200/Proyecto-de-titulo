import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { MedioPago, Rol } from "@prisma/client";

vi.mock("../../lib/prisma", () => {
  const prisma: Record<string, unknown> = {
    cobroGastoComun: { findFirst: vi.fn(), findUnique: vi.fn() },
    usuario: { findFirst: vi.fn(), findMany: vi.fn() },
    comprobantePago: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    pagoGastoComun: { create: vi.fn() },
    $executeRaw: vi.fn(),
  };
  prisma.$transaction = vi.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return { prisma };
});
vi.mock("../notificaciones/notificaciones.service", () => ({ crearNotificacionesMasivas: vi.fn() }));

import { prisma } from "../../lib/prisma";
import { crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { aprobarComprobante, informarPago, obtenerArchivoComprobante, rechazarComprobante } from "./comprobantes.service";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors";

const p = prisma as unknown as Record<string, Record<string, Mock>> & { $executeRaw: Mock };
const notificar = crearNotificacionesMasivas as unknown as Mock;
const AHORA = new Date("2026-10-05T18:00:00.000Z");
const DATOS = { monto: 50000, fechaPago: "2026-10-04", medio: MedioPago.TRANSFERENCIA, referencia: "0045" };
const ARCHIVO = "data:image/png;base64,AAAA";

const COBRO = {
  id: "c-1",
  departamentoId: "d-1",
  montoTotal: 100000,
  montoPagado: 20000,
  departamento: { id: "d-1", numero: "101", torre: { nombre: "Torre A" } },
  periodo: { anio: 2026, mes: 9 },
};

beforeEach(() => {
  vi.clearAllMocks();
  p.cobroGastoComun.findFirst.mockResolvedValue(COBRO);
  p.usuario.findFirst.mockResolvedValue({ id: "res-1" });
  p.usuario.findMany.mockResolvedValue([{ id: "admin-1" }]);
  p.comprobantePago.findFirst.mockResolvedValue(null);
  p.comprobantePago.create.mockResolvedValue({ id: "cmp-1", monto: 50000 });
  p.pagoGastoComun.create.mockResolvedValue({ id: "pago-1" });
});

describe("informarPago (residente)", () => {
  it("guarda el comprobante pendiente y avisa a la administracion", async () => {
    const r = await informarPago("condo-1", "res-1", "c-1", DATOS, ARCHIVO, AHORA);
    expect(r).toMatchObject({ id: "cmp-1", unidad: "Torre A 101", periodo: "septiembre de 2026" });
    expect(p.comprobantePago.create.mock.calls[0][0].data).toMatchObject({ cobroId: "c-1", informadoPorId: "res-1", monto: 50000, archivo: ARCHIVO });
    expect(notificar).toHaveBeenCalledWith(["admin-1"], expect.objectContaining({ entidadTipo: "ComprobantePago", entidadId: "cmp-1" }));
  });

  it("no deja informar pagos de otra unidad", async () => {
    p.usuario.findFirst.mockResolvedValue(null);
    await expect(informarPago("condo-1", "res-2", "c-1", DATOS, ARCHIVO, AHORA)).rejects.toBeInstanceOf(NotFoundError);
    expect(p.comprobantePago.create).not.toHaveBeenCalled();
  });

  it("rechaza un monto mayor al saldo, un mes ya pagado y una fecha futura", async () => {
    await expect(informarPago("condo-1", "res-1", "c-1", { ...DATOS, monto: 90000 }, ARCHIVO, AHORA)).rejects.toBeInstanceOf(AppError);
    p.cobroGastoComun.findFirst.mockResolvedValue({ ...COBRO, montoPagado: 100000 });
    await expect(informarPago("condo-1", "res-1", "c-1", DATOS, ARCHIVO, AHORA)).rejects.toBeInstanceOf(ConflictError);
    p.cobroGastoComun.findFirst.mockResolvedValue(COBRO);
    await expect(informarPago("condo-1", "res-1", "c-1", { ...DATOS, fechaPago: "2026-10-06" }, ARCHIVO, AHORA)).rejects.toBeInstanceOf(AppError);
    expect(p.comprobantePago.create).not.toHaveBeenCalled();
  });

  it("no acepta un segundo comprobante mientras el anterior espera revision", async () => {
    p.comprobantePago.findFirst.mockResolvedValue({ id: "cmp-0" });
    await expect(informarPago("condo-1", "res-1", "c-1", DATOS, ARCHIVO, AHORA)).rejects.toBeInstanceOf(ConflictError);
  });
});

const COMPROBANTE = {
  id: "cmp-1",
  monto: 50000,
  fechaPago: new Date("2026-10-04T00:00:00.000Z"),
  medio: MedioPago.TRANSFERENCIA,
  referencia: "0045",
  estado: "PENDIENTE",
  cobroId: "c-1",
  cobro: { departamentoId: "d-1", departamento: COBRO.departamento, periodo: COBRO.periodo },
};

describe("aprobarComprobante", () => {
  beforeEach(() => {
    p.comprobantePago.findFirst.mockResolvedValue(COMPROBANTE);
    p.comprobantePago.updateMany.mockResolvedValue({ count: 1 });
    p.$executeRaw.mockResolvedValue(1);
    p.cobroGastoComun.findUnique.mockResolvedValue({ montoTotal: 100000, montoPagado: 70000, pagado: false });
    p.usuario.findMany.mockResolvedValue([{ id: "res-1" }]);
  });

  it("registra el pago, enlaza el comprobante y avisa al residente", async () => {
    const r = await aprobarComprobante("condo-1", "cmp-1", "admin-1");
    expect(r).toMatchObject({ monto: 50000, saldo: 30000, pagado: false });
    expect(p.comprobantePago.updateMany.mock.calls[0][0].where).toEqual({ id: "cmp-1", estado: "PENDIENTE" });
    expect(p.pagoGastoComun.create.mock.calls[0][0].data).toMatchObject({ cobroId: "c-1", monto: 50000, registradoPorId: "admin-1" });
    expect(p.comprobantePago.update).toHaveBeenCalledWith({ where: { id: "cmp-1" }, data: { pagoId: "pago-1" } });
    expect(notificar.mock.calls[0][1].titulo).toBe("Pago aprobado");
  });

  it("permite aprobar por un monto menor, nunca mayor al informado", async () => {
    await aprobarComprobante("condo-1", "cmp-1", "admin-1", 30000);
    expect(p.pagoGastoComun.create.mock.calls[0][0].data.monto).toBe(30000);
    await expect(aprobarComprobante("condo-1", "cmp-1", "admin-1", 60000)).rejects.toBeInstanceOf(AppError);
  });

  it("si ya fue revisado (dos administradores a la vez), no suma el pago otra vez", async () => {
    p.comprobantePago.updateMany.mockResolvedValue({ count: 0 });
    await expect(aprobarComprobante("condo-1", "cmp-1", "admin-1")).rejects.toBeInstanceOf(ConflictError);
    expect(p.$executeRaw).not.toHaveBeenCalled();
  });

  it("si el pago ya no cabe en el saldo, no se aprueba (y se explica)", async () => {
    p.$executeRaw.mockResolvedValue(0);
    p.cobroGastoComun.findUnique.mockResolvedValue({ montoTotal: 100000, montoPagado: 80000 });
    await expect(aprobarComprobante("condo-1", "cmp-1", "admin-1")).rejects.toThrow(/supera el saldo pendiente/);
    expect(p.comprobantePago.update).not.toHaveBeenCalled();
    expect(notificar).not.toHaveBeenCalled();
  });
});

describe("rechazarComprobante", () => {
  it("lo marca rechazado con el motivo y avisa al residente", async () => {
    p.comprobantePago.findFirst.mockResolvedValue(COMPROBANTE);
    p.comprobantePago.updateMany.mockResolvedValue({ count: 1 });
    p.usuario.findMany.mockResolvedValue([{ id: "res-1" }]);
    await rechazarComprobante("condo-1", "cmp-1", "admin-1", "La imagen no se lee.");
    expect(p.comprobantePago.updateMany.mock.calls[0][0].data).toMatchObject({ estado: "RECHAZADO", motivoRechazo: "La imagen no se lee." });
    expect(notificar.mock.calls[0][1].mensaje).toMatch(/Motivo: La imagen no se lee\./);
  });

  it("no rechaza uno ya revisado", async () => {
    p.comprobantePago.findFirst.mockResolvedValue(COMPROBANTE);
    p.comprobantePago.updateMany.mockResolvedValue({ count: 0 });
    await expect(rechazarComprobante("condo-1", "cmp-1", "admin-1", "Motivo cualquiera")).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("obtenerArchivoComprobante", () => {
  it("un residente de otra unidad no puede ver el archivo; la administracion si", async () => {
    p.comprobantePago.findFirst.mockResolvedValue({ archivo: ARCHIVO, cobro: { departamentoId: "d-1" } });
    p.usuario.findFirst.mockResolvedValue(null);
    await expect(obtenerArchivoComprobante("condo-1", "cmp-1", { id: "res-2", rol: Rol.RESIDENTE })).rejects.toBeInstanceOf(NotFoundError);
    await expect(obtenerArchivoComprobante("condo-1", "cmp-1", { id: "admin-1", rol: Rol.ADMIN })).resolves.toBe(ARCHIVO);
  });
});
