import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { MedioPago, MetodoProrrateo, Prisma, Rol } from "@prisma/client";

vi.mock("../../lib/prisma", () => {
  const prisma: Record<string, unknown> = {
    periodoGastoComun: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    cobroGastoComun: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), createMany: vi.fn(), groupBy: vi.fn() },
    pagoGastoComun: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    departamento: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    usuario: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    notificacion: { deleteMany: vi.fn() },
    $executeRaw: vi.fn(),
  };
  // Forma de arreglo: ejecuta las operaciones; forma de funcion: le pasa el mismo cliente como "tx".
  prisma.$transaction = vi.fn(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[])
  );
  return { prisma };
});
vi.mock("../notificaciones/notificaciones.service", () => ({ crearNotificacionesMasivas: vi.fn() }));

import { prisma } from "../../lib/prisma";
import { crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import {
  anularPago,
  crearPeriodo,
  eliminarPeriodo,
  guardarAlicuotas,
  listarMorosidad,
  obtenerCobro,
  obtenerMiCuenta,
  registrarPago,
} from "./gastos-comunes.service";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors";

const p = prisma as unknown as Record<string, Record<string, Mock>> & { $executeRaw: Mock; $transaction: Mock };
const notificar = crearNotificacionesMasivas as unknown as Mock;

// 5 de octubre de 2026, 15:00 en Chile
const AHORA = new Date("2026-10-05T18:00:00.000Z");
const TORRE_A = { nombre: "Torre A" };

const PERIODO = {
  anio: 2026,
  mes: 10,
  fechaVencimiento: "2026-11-10",
  metodoProrrateo: MetodoProrrateo.PARTES_IGUALES,
  porcentajeFondoReserva: 5,
  partidas: [
    { concepto: "Remuneraciones", monto: 600_000 },
    { concepto: "Agua de áreas comunes", monto: 400_000 },
  ],
};

const DEPTOS = [
  { id: "d-1", numero: "101", alicuota: null, torre: TORRE_A },
  { id: "d-2", numero: "102", alicuota: null, torre: TORRE_A },
  { id: "d-3", numero: "201", alicuota: null, torre: { nombre: "Torre B" } },
];

beforeEach(() => {
  vi.clearAllMocks();
  p.periodoGastoComun.findFirst.mockResolvedValue(null);
  p.departamento.findMany.mockResolvedValue(DEPTOS);
  p.usuario.findMany.mockResolvedValue([{ id: "r-1" }]);
  p.periodoGastoComun.create.mockResolvedValue({});
  p.cobroGastoComun.createMany.mockResolvedValue({ count: 3 });
});

describe("crearPeriodo", () => {
  it("crea un cobro por unidad que suma exacto el total, con el fondo de reserva, y avisa a cada unidad", async () => {
    const r = await crearPeriodo("condo-1", "admin-1", PERIODO, AHORA);

    const cobros = p.cobroGastoComun.createMany.mock.calls[0][0].data;
    expect(cobros).toHaveLength(3);
    expect(cobros.map((c: { montoGastoComun: number }) => c.montoGastoComun)).toEqual([333_334, 333_333, 333_333]);
    expect(cobros[0]).toMatchObject({ condominioId: "condo-1", departamentoId: "d-1", montoFondoReserva: 16_667, montoTotal: 350_001 });
    expect(cobros.every((c: { periodoId: string }) => c.periodoId === r.id)).toBe(true);

    const periodo = p.periodoGastoComun.create.mock.calls[0][0].data;
    expect(periodo).toMatchObject({ condominioId: "condo-1", creadoPorId: "admin-1", totalGastos: 1_000_000 });
    expect(periodo.fechaVencimiento).toEqual(new Date("2026-11-10T00:00:00.000Z"));
    expect(periodo.partidas.createMany.data[1]).toEqual({ concepto: "Agua de áreas comunes", monto: 400_000, orden: 1 });

    expect(r).toMatchObject({ nombre: "octubre de 2026", unidades: 3, totalCobrado: 1_050_001 });
    expect(notificar).toHaveBeenCalledTimes(3);
    expect(notificar.mock.calls[0][1]).toMatchObject({
      tipo: "GASTO_COMUN",
      titulo: "Gasto común de octubre de 2026",
      mensaje: "A tu unidad le corresponden $350.001, con vencimiento el 10 de noviembre.",
      entidadTipo: "CobroGastoComun",
      entidadId: cobros[0].id,
    });
  });

  it("reparte según alícuota cuando todas suman 100 %", async () => {
    p.departamento.findMany.mockResolvedValue([
      { ...DEPTOS[0], alicuota: new Prisma.Decimal("50") },
      { ...DEPTOS[1], alicuota: new Prisma.Decimal("30") },
      { ...DEPTOS[2], alicuota: new Prisma.Decimal("20") },
    ]);
    await crearPeriodo("condo-1", "admin-1", { ...PERIODO, metodoProrrateo: MetodoProrrateo.ALICUOTA, porcentajeFondoReserva: 0 }, AHORA);
    const cobros = p.cobroGastoComun.createMany.mock.calls[0][0].data;
    expect(cobros.map((c: { montoTotal: number }) => c.montoTotal)).toEqual([500_000, 300_000, 200_000]);
  });

  it("no emite si faltan alícuotas o no suman 100 %", async () => {
    p.departamento.findMany.mockResolvedValue([{ ...DEPTOS[0], alicuota: new Prisma.Decimal("60") }, DEPTOS[1], DEPTOS[2]]);
    const conAlicuota = { ...PERIODO, metodoProrrateo: MetodoProrrateo.ALICUOTA };
    await expect(crearPeriodo("condo-1", "admin-1", conAlicuota, AHORA)).rejects.toThrow("Faltan las alícuotas de 2 unidades");

    p.departamento.findMany.mockResolvedValue([
      { ...DEPTOS[0], alicuota: new Prisma.Decimal("60") },
      { ...DEPTOS[1], alicuota: new Prisma.Decimal("30") },
      { ...DEPTOS[2], alicuota: new Prisma.Decimal("5.5") },
    ]);
    await expect(crearPeriodo("condo-1", "admin-1", conAlicuota, AHORA)).rejects.toThrow("suman 95,5 %");
    expect(p.cobroGastoComun.createMany).not.toHaveBeenCalled();
  });

  it("rechaza un mes ya emitido, un vencimiento pasado y un condominio sin unidades", async () => {
    p.periodoGastoComun.findFirst.mockResolvedValueOnce({ id: "ya" });
    await expect(crearPeriodo("condo-1", "admin-1", PERIODO, AHORA)).rejects.toBeInstanceOf(ConflictError);

    await expect(crearPeriodo("condo-1", "admin-1", { ...PERIODO, fechaVencimiento: "2026-10-04" }, AHORA)).rejects.toThrow(
      "no puede ser anterior a hoy"
    );

    p.departamento.findMany.mockResolvedValueOnce([]);
    await expect(crearPeriodo("condo-1", "admin-1", PERIODO, AHORA)).rejects.toThrow("no tiene unidades");
    expect(p.cobroGastoComun.createMany).not.toHaveBeenCalled();
  });

  it("si otra persona emitió el mismo mes al mismo tiempo, responde 409 en vez de un error interno", async () => {
    p.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicado", { code: "P2002", clientVersion: "5.22.0" })
    );
    await expect(crearPeriodo("condo-1", "admin-1", PERIODO, AHORA)).rejects.toThrow("Ya se emitió el cobro de octubre de 2026.");
    expect(notificar).not.toHaveBeenCalled();
  });
});

describe("registrarPago", () => {
  const COBRO = { id: "c-1", departamentoId: "d-1", departamento: { id: "d-1", numero: "101", torre: TORRE_A }, periodo: { anio: 2026, mes: 10 } };
  const PAGO = { monto: 100_000, fechaPago: "2026-10-05", medio: MedioPago.TRANSFERENCIA, referencia: "OP-1" };

  beforeEach(() => {
    p.cobroGastoComun.findFirst.mockResolvedValue(COBRO);
  });

  it("suma el pago de forma atómica y avisa el saldo que queda", async () => {
    p.$executeRaw.mockResolvedValue(1);
    p.cobroGastoComun.findUnique.mockResolvedValue({ montoTotal: 350_001, montoPagado: 100_000, pagado: false });

    const r = await registrarPago("condo-1", "c-1", "admin-1", PAGO, AHORA);

    expect(r).toEqual({ unidad: "Torre A 101", periodo: "octubre de 2026", saldo: 250_001, pagado: false });
    expect(p.pagoGastoComun.create.mock.calls[0][0].data).toMatchObject({
      cobroId: "c-1",
      monto: 100_000,
      medio: "TRANSFERENCIA",
      referencia: "OP-1",
      registradoPorId: "admin-1",
    });
    // la condicion que impide pagar de mas va dentro del UPDATE
    const sql = (p.$executeRaw.mock.calls[0][0] as string[]).join("?");
    expect(sql).toContain('"montoPagado" + ? <= "montoTotal"');
    expect(notificar.mock.calls[0][1].mensaje).toBe(
      "Se registró un pago de $100.000 del gasto común de octubre de 2026. Saldo pendiente: $250.001."
    );
  });

  it("cuando el pago completa el total, el aviso dice que quedó pagado", async () => {
    p.$executeRaw.mockResolvedValue(1);
    p.cobroGastoComun.findUnique.mockResolvedValue({ montoTotal: 100_000, montoPagado: 100_000, pagado: true });
    const r = await registrarPago("condo-1", "c-1", "admin-1", PAGO, AHORA);
    expect(r.pagado).toBe(true);
    expect(notificar.mock.calls[0][1].mensaje).toBe("Se registró un pago de $100.000. El gasto común de octubre de 2026 quedó pagado.");
  });

  it("no deja pagar más que el saldo, ni dos veces un cobro ya pagado", async () => {
    p.$executeRaw.mockResolvedValue(0);
    p.cobroGastoComun.findUnique.mockResolvedValueOnce({ montoTotal: 350_001, montoPagado: 300_000 });
    await expect(registrarPago("condo-1", "c-1", "admin-1", PAGO, AHORA)).rejects.toThrow(
      "El monto supera el saldo pendiente de esta unidad ($50.001)."
    );

    p.cobroGastoComun.findUnique.mockResolvedValueOnce({ montoTotal: 350_001, montoPagado: 350_001 });
    await expect(registrarPago("condo-1", "c-1", "admin-1", PAGO, AHORA)).rejects.toThrow("Este cobro ya está pagado.");
    expect(p.pagoGastoComun.create).not.toHaveBeenCalled();
    expect(notificar).not.toHaveBeenCalled();
  });

  it("rechaza una fecha de pago futura y un cobro de otro condominio", async () => {
    await expect(registrarPago("condo-1", "c-1", "admin-1", { ...PAGO, fechaPago: "2026-10-06" }, AHORA)).rejects.toBeInstanceOf(AppError);
    p.cobroGastoComun.findFirst.mockResolvedValueOnce(null);
    await expect(registrarPago("condo-2", "c-1", "admin-1", PAGO, AHORA)).rejects.toBeInstanceOf(NotFoundError);
    expect(p.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("anularPago", () => {
  const PAGO = {
    id: "p-1",
    monto: 100_000,
    cobroId: "c-1",
    cobro: { departamentoId: "d-1", departamento: { id: "d-1", numero: "101", torre: TORRE_A }, periodo: { anio: 2026, mes: 10 } },
  };

  it("marca el pago como anulado, descuenta el monto y avisa con el motivo", async () => {
    p.pagoGastoComun.findFirst.mockResolvedValue(PAGO);
    p.pagoGastoComun.updateMany.mockResolvedValue({ count: 1 });
    p.$executeRaw.mockResolvedValue(1);

    await anularPago("condo-1", "p-1", "admin-1", "Se registró dos veces");

    expect(p.pagoGastoComun.updateMany.mock.calls[0][0].where).toEqual({ id: "p-1", anuladoEn: null });
    expect((p.$executeRaw.mock.calls[0][0] as string[]).join("?")).toContain('"montoPagado" = "montoPagado" - ?');
    expect(notificar.mock.calls[0][1].mensaje).toBe(
      "Se anuló un pago de $100.000 del gasto común de octubre de 2026. Motivo: Se registró dos veces"
    );
  });

  it("no descuenta dos veces si el pago ya estaba anulado", async () => {
    p.pagoGastoComun.findFirst.mockResolvedValue(PAGO);
    p.pagoGastoComun.updateMany.mockResolvedValue({ count: 0 });
    await expect(anularPago("condo-1", "p-1", "admin-1", "Otra vez")).rejects.toThrow("Este pago ya estaba anulado.");
    expect(p.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("eliminarPeriodo", () => {
  it("no elimina un cobro con pagos vigentes (la condición va en el mismo DELETE)", async () => {
    p.periodoGastoComun.findFirst.mockResolvedValue({ anio: 2026, mes: 10, cobros: [{ id: "c-1", departamentoId: "d-1" }] });
    p.periodoGastoComun.deleteMany.mockResolvedValue({ count: 0 });
    await expect(eliminarPeriodo("condo-1", "per-1")).rejects.toThrow("tiene pagos registrados");
    expect(p.periodoGastoComun.deleteMany.mock.calls[0][0].where).toEqual({
      id: "per-1",
      condominioId: "condo-1",
      cobros: { none: { pagos: { some: { anuladoEn: null } } } },
    });
    expect(p.notificacion.deleteMany).not.toHaveBeenCalled();
  });

  it("al eliminar, borra los avisos que apuntaban al cobro y explica lo que pasó", async () => {
    p.periodoGastoComun.findFirst.mockResolvedValue({ anio: 2026, mes: 10, cobros: [{ id: "c-1", departamentoId: "d-1" }] });
    p.periodoGastoComun.deleteMany.mockResolvedValue({ count: 1 });
    await eliminarPeriodo("condo-1", "per-1");
    expect(p.notificacion.deleteMany.mock.calls[0][0].where).toEqual({ entidadTipo: "CobroGastoComun", entidadId: { in: ["c-1"] } });
    expect(notificar.mock.calls[0][1].titulo).toBe("Cobro de octubre de 2026 eliminado");
  });
});

describe("listarMorosidad", () => {
  it("agrupa por unidad y ordena de la que más debe a la que menos", async () => {
    const unidad = (id: string, numero: string) => ({ id, numero, torre: TORRE_A, residentes: [] });
    p.cobroGastoComun.findMany.mockResolvedValue([
      { id: "c-1", montoTotal: 100_000, montoPagado: 0, periodo: { id: "x", anio: 2026, mes: 8 }, departamento: unidad("d-1", "101") },
      { id: "c-2", montoTotal: 100_000, montoPagado: 40_000, periodo: { id: "y", anio: 2026, mes: 9 }, departamento: unidad("d-2", "102") },
      { id: "c-3", montoTotal: 100_000, montoPagado: 0, periodo: { id: "y", anio: 2026, mes: 9 }, departamento: unidad("d-1", "101") },
    ]);
    const r = await listarMorosidad("condo-1", AHORA);
    expect(r.map((u) => [u.departamento.numero, u.deuda, u.cobros.length])).toEqual([
      ["101", 200_000, 2],
      ["102", 60_000, 1],
    ]);
    expect(p.cobroGastoComun.findMany.mock.calls[0][0].where).toEqual({
      condominioId: "condo-1",
      pagado: false,
      periodo: { fechaVencimiento: { lt: new Date("2026-10-05T00:00:00.000Z") } },
    });
  });
});

describe("obtenerCobro y obtenerMiCuenta", () => {
  const COBRO = {
    id: "c-1",
    departamentoId: "d-1",
    montoTotal: 100_000,
    montoPagado: 0,
    pagado: false,
    periodo: { fechaVencimiento: new Date("2026-10-01T00:00:00.000Z") },
    pagos: [],
  };

  it("un residente de otra unidad no puede ver el cobro", async () => {
    p.cobroGastoComun.findFirst.mockResolvedValue(COBRO);
    p.usuario.findFirst.mockResolvedValue(null);
    await expect(obtenerCobro("condo-1", "c-1", { id: "r-9", rol: Rol.RESIDENTE }, AHORA)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("el residente de la unidad lo ve, con estado y saldo calculados", async () => {
    p.cobroGastoComun.findFirst.mockResolvedValue(COBRO);
    p.usuario.findFirst.mockResolvedValue({ id: "r-1" });
    const r = await obtenerCobro("condo-1", "c-1", { id: "r-1", rol: Rol.RESIDENTE }, AHORA);
    expect(r).toMatchObject({ saldo: 100_000, estado: "VENCIDO" });
    expect(r).not.toHaveProperty("pagado");
  });

  it("el estado de cuenta suma lo vencido aparte y toma el próximo vencimiento pendiente", async () => {
    p.usuario.findUnique.mockResolvedValue({ departamento: { id: "d-1", numero: "101", torre: TORRE_A } });
    const periodo = (mes: number, vence: string) => ({
      anio: 2026,
      mes,
      fechaVencimiento: new Date(`${vence}T00:00:00.000Z`),
      instruccionesPago: mes === 10 ? "Transferir a la cuenta de la comunidad" : null,
    });
    p.cobroGastoComun.findMany.mockResolvedValue([
      { id: "c-10", montoTotal: 90_000, montoPagado: 0, pagado: false, periodo: periodo(10, "2026-11-10") },
      { id: "c-9", montoTotal: 80_000, montoPagado: 30_000, pagado: false, periodo: periodo(9, "2026-10-10") },
      { id: "c-8", montoTotal: 80_000, montoPagado: 0, pagado: false, periodo: periodo(8, "2026-09-10") },
      { id: "c-7", montoTotal: 80_000, montoPagado: 80_000, pagado: true, periodo: periodo(7, "2026-08-10") },
    ]);

    const r = await obtenerMiCuenta("r-1", AHORA);

    expect(r).toMatchObject({ saldoPendiente: 220_000, deudaVencida: 80_000, cobrosVencidos: 1 });
    expect(r.proximoVencimiento).toEqual(new Date("2026-10-10T00:00:00.000Z"));
    expect(r.instruccionesPago).toBe("Transferir a la cuenta de la comunidad");
    expect(r.cobros.map((c) => c.estado)).toEqual(["PENDIENTE", "PENDIENTE", "VENCIDO", "PAGADO"]);
  });

  it("sin unidad asignada devuelve una cuenta vacía", async () => {
    p.usuario.findUnique.mockResolvedValue({ departamento: null });
    const r = await obtenerMiCuenta("r-1", AHORA);
    expect(r).toMatchObject({ unidad: null, saldoPendiente: 0, cobros: [] });
  });
});

describe("guardarAlicuotas", () => {
  it("rechaza unidades repetidas o de otro condominio", async () => {
    await expect(
      guardarAlicuotas("condo-1", [
        { departamentoId: "d-1", alicuota: 50 },
        { departamentoId: "d-1", alicuota: 50 },
      ])
    ).rejects.toThrow("repetidas");

    p.departamento.count.mockResolvedValue(1);
    await expect(
      guardarAlicuotas("condo-1", [
        { departamentoId: "d-1", alicuota: 50 },
        { departamentoId: "d-otro", alicuota: 50 },
      ])
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(p.departamento.update).not.toHaveBeenCalled();
  });
});
