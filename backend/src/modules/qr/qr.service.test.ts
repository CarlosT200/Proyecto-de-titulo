import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoVisita, ResultadoAcceso, TipoQrToken } from "@prisma/client";

// Se mockea solo la capa de datos (prisma) -- la firma/verificacion del JWT
// (lib/qrToken.ts) corre de verdad, asi el test ejercita el camino completo
// que importa: token real -> busqueda del registro -> reglas de negocio.
vi.mock("../../lib/prisma", () => ({
  prisma: {
    qrToken: { findUnique: vi.fn(), update: vi.fn() },
    visita: { update: vi.fn() },
    accesoLog: { create: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma";
import { signQrToken } from "../../lib/qrToken";
import { validarQr } from "./qr.service";

const findUnique = prisma.qrToken.findUnique as unknown as Mock;
const updateToken = prisma.qrToken.update as unknown as Mock;
const updateVisita = prisma.visita.update as unknown as Mock;
const crearAccesoLog = prisma.accesoLog.create as unknown as Mock;

function persona(nombre = "Roberto", apellido = "Residente") {
  return {
    id: "usuario-1",
    nombre,
    apellido,
    departamento: { numero: "101", torre: { nombre: "Torre A" } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateToken.mockResolvedValue({});
  updateVisita.mockResolvedValue({});
  crearAccesoLog.mockResolvedValue({});
});

// HU-18 / HU-21: validarQr es la puerta de entrada real del condominio --
// cada caso aca es un escenario que un conserje puede encontrar al escanear.
describe("validarQr", () => {
  it("autoriza el QR de un residente vigente y devuelve sus datos", async () => {
    const expiraEn = new Date(Date.now() + 60_000);
    const token = signQrToken("qr-1", "RESIDENTE", expiraEn);
    findUnique.mockResolvedValueOnce({
      id: "qr-1",
      tipo: TipoQrToken.RESIDENTE,
      revocado: false,
      expiraEn,
      usosMaximos: null,
      usosRealizados: 0,
      usuario: persona(),
      visita: null,
    });

    const resultado = await validarQr("condo-1", "conserje-1", token);

    expect(resultado.resultado).toBe(ResultadoAcceso.AUTORIZADO);
    expect(resultado.detalle).toEqual({ residente: persona() });
    expect(updateToken).toHaveBeenCalledWith({
      where: { id: "qr-1" },
      data: { usosRealizados: { increment: 1 } },
    });
  });

  it("rechaza un QR de residente revocado", async () => {
    const expiraEn = new Date(Date.now() + 60_000);
    const token = signQrToken("qr-2", "RESIDENTE", expiraEn);
    findUnique.mockResolvedValueOnce({
      id: "qr-2",
      tipo: TipoQrToken.RESIDENTE,
      revocado: true,
      expiraEn,
      usosMaximos: null,
      usosRealizados: 0,
      usuario: persona(),
      visita: null,
    });

    const resultado = await validarQr("condo-1", "conserje-1", token);

    expect(resultado.resultado).toBe(ResultadoAcceso.RECHAZADO);
    expect(resultado.motivo).toMatch(/revocado/i);
    expect(updateToken).not.toHaveBeenCalled();
  });

  it("autoriza una visita vigente de un solo uso y la marca como usada", async () => {
    const periodoFin = new Date(Date.now() + 60_000);
    const token = signQrToken("qr-3", "VISITA", periodoFin);
    findUnique.mockResolvedValueOnce({
      id: "qr-3",
      tipo: TipoQrToken.VISITA,
      revocado: false,
      expiraEn: periodoFin,
      usosMaximos: 1,
      usosRealizados: 0,
      usuario: null,
      visita: {
        id: "visita-1",
        estado: EstadoVisita.VIGENTE,
        soloUnUso: true,
        nombreVisita: "Pedro Delivery",
        periodoInicio: new Date(Date.now() - 60_000),
        periodoFin,
        residente: persona(),
      },
    });

    const resultado = await validarQr("condo-1", "conserje-1", token);

    expect(resultado.resultado).toBe(ResultadoAcceso.AUTORIZADO);
    expect(resultado.detalle).toEqual({ visita: { nombreVisita: "Pedro Delivery", residente: persona() } });
    expect(updateVisita).toHaveBeenCalledWith({
      where: { id: "visita-1" },
      data: { estado: EstadoVisita.USADA },
    });
  });

  it("rechaza una visita que ya alcanzo su limite de usos", async () => {
    const periodoFin = new Date(Date.now() + 60_000);
    const token = signQrToken("qr-4", "VISITA", periodoFin);
    findUnique.mockResolvedValueOnce({
      id: "qr-4",
      tipo: TipoQrToken.VISITA,
      revocado: false,
      expiraEn: periodoFin,
      usosMaximos: 1,
      usosRealizados: 1,
      usuario: null,
      visita: {
        id: "visita-2",
        estado: EstadoVisita.VIGENTE,
        soloUnUso: true,
        nombreVisita: "Visita repetida",
        periodoInicio: new Date(Date.now() - 60_000),
        periodoFin,
        residente: persona(),
      },
    });

    const resultado = await validarQr("condo-1", "conserje-1", token);

    expect(resultado.resultado).toBe(ResultadoAcceso.RECHAZADO);
    expect(resultado.motivo).toMatch(/ya fue utilizado/i);
  });

  it("rechaza un token que no corresponde a ningún registro en la base de datos", async () => {
    const token = signQrToken("qr-inexistente", "RESIDENTE", new Date(Date.now() + 60_000));
    findUnique.mockResolvedValueOnce(null);

    const resultado = await validarQr("condo-1", "conserje-1", token);

    expect(resultado.resultado).toBe(ResultadoAcceso.RECHAZADO);
    expect(resultado.motivo).toMatch(/no reconocido/i);
  });

  it("rechaza un texto que no es un QR válido sin consultar la base de datos", async () => {
    const resultado = await validarQr("condo-1", "conserje-1", "esto-no-es-un-jwt");

    expect(resultado.resultado).toBe(ResultadoAcceso.RECHAZADO);
    expect(resultado.motivo).toMatch(/inválido o expirado/i);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
