import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoVisita, ResultadoAcceso, TipoQrToken } from "@prisma/client";

// Se mockea solo la capa de datos (prisma) -- la firma/verificacion del JWT
// (lib/qrToken.ts) corre de verdad, asi el test ejercita el camino completo
// que importa: token real -> busqueda del registro -> reglas de negocio.
vi.mock("../../lib/prisma", () => ({
  prisma: {
    qrToken: { findUnique: vi.fn(), updateMany: vi.fn() },
    visita: { update: vi.fn() },
    accesoLog: { create: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma";
import { nuevoTokenQr, signQrToken } from "../../lib/qrToken";
import { validarQr } from "./qr.service";

const findUnique = prisma.qrToken.findUnique as unknown as Mock;
const updateManyToken = prisma.qrToken.updateMany as unknown as Mock;
const updateVisita = prisma.visita.update as unknown as Mock;
const crearAccesoLog = prisma.accesoLog.create as unknown as Mock;

function persona(nombre = "Roberto", apellido = "Residente") {
  return {
    id: "usuario-1",
    condominioId: "condo-1",
    activo: true,
    nombre,
    apellido,
    departamento: { numero: "101", torre: { nombre: "Torre A" } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateManyToken.mockResolvedValue({ count: 1 });
  updateVisita.mockResolvedValue({});
  crearAccesoLog.mockResolvedValue({});
});

// HU-18 / HU-21: validarQr es la puerta de entrada real del condominio --
// cada caso aca es un escenario que un conserje puede encontrar al escanear.
describe("validarQr: codigo corto (formato actual)", () => {
  it("busca el registro por el codigo y autoriza al residente", async () => {
    const codigo = nuevoTokenQr();
    const expiraEn = new Date(Date.now() + 60_000);
    findUnique.mockResolvedValueOnce({
      id: "qr-corto",
      tipo: TipoQrToken.RESIDENTE,
      revocado: false,
      expiraEn,
      usosMaximos: null,
      usosRealizados: 0,
      usuario: persona(),
      visita: null,
    });

    const resultado = await validarQr("condo-1", "conserje-1", codigo);

    expect(resultado.resultado).toBe(ResultadoAcceso.AUTORIZADO);
    expect(findUnique.mock.calls[0][0].where).toEqual({ token: codigo });
  });

  it("el vencimiento sale de la base: un codigo corto vencido se rechaza", async () => {
    findUnique.mockResolvedValueOnce({
      id: "qr-vencido",
      tipo: TipoQrToken.RESIDENTE,
      revocado: false,
      expiraEn: new Date(Date.now() - 1000),
      usosMaximos: null,
      usosRealizados: 0,
      usuario: persona(),
      visita: null,
    });

    const resultado = await validarQr("condo-1", "conserje-1", nuevoTokenQr());

    expect(resultado.resultado).toBe(ResultadoAcceso.RECHAZADO);
    expect(resultado.motivo).toBe("El código QR se encuentra vencido.");
    expect(updateManyToken).not.toHaveBeenCalled();
  });

  it("un codigo corto que no existe se rechaza como no reconocido", async () => {
    findUnique.mockResolvedValueOnce(null);
    const resultado = await validarQr("condo-1", "conserje-1", nuevoTokenQr());
    expect(resultado).toMatchObject({ resultado: ResultadoAcceso.RECHAZADO, motivo: "Código QR no reconocido." });
  });

  it("texto que no es ni codigo corto ni JWT se rechaza sin consultar la base", async () => {
    const resultado = await validarQr("condo-1", "conserje-1", "cualquier-cosa-que-no-sirve");
    expect(resultado).toMatchObject({ resultado: ResultadoAcceso.RECHAZADO, motivo: "Código QR inválido o expirado." });
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("validarQr: JWT (QR emitidos antes del codigo corto siguen valiendo)", () => {
  it("un QR del formato anterior se busca por el id firmado y se autoriza", async () => {
    const expiraEn = new Date(Date.now() + 60_000);
    findUnique.mockResolvedValueOnce({
      id: "qr-viejo",
      tipo: TipoQrToken.RESIDENTE,
      revocado: false,
      expiraEn,
      usosMaximos: null,
      usosRealizados: 0,
      usuario: persona(),
      visita: null,
    });

    const resultado = await validarQr("condo-1", "conserje-1", signQrToken("qr-viejo", "RESIDENTE", expiraEn));

    expect(resultado.resultado).toBe(ResultadoAcceso.AUTORIZADO);
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: "qr-viejo" });
  });
});

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
    // el uso se reclama de forma atomica (condicion + incremento en una sola operacion)
    expect(updateManyToken).toHaveBeenCalledWith({
      where: { id: "qr-1", revocado: false },
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
    expect(updateManyToken).not.toHaveBeenCalled();
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
        condominioId: "condo-1",
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
        condominioId: "condo-1",
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

describe("validarQr: casos de seguridad", () => {
  function visitaDeUnUso(id: string, usosRealizados = 0) {
    const periodoFin = new Date(Date.now() + 60_000);
    return {
      token: signQrToken(id, "VISITA", periodoFin),
      registro: {
        id,
        tipo: TipoQrToken.VISITA,
        revocado: false,
        expiraEn: periodoFin,
        usosMaximos: 1,
        usosRealizados,
        usuario: null,
        visita: {
          id: `visita-${id}`,
          condominioId: "condo-1",
          estado: EstadoVisita.VIGENTE,
          soloUnUso: true,
          nombreVisita: "Visita",
          periodoInicio: new Date(Date.now() - 60_000),
          periodoFin,
          residente: persona(),
        },
      },
    };
  }

  it("un QR de un solo uso entra una sola vez aunque dos escaneos lleguen a la vez", async () => {
    const { token, registro } = visitaDeUnUso("qr-carrera");
    // los dos escaneos leen usosRealizados = 0; la base solo deja pasar al primero
    findUnique.mockResolvedValue(registro);
    updateManyToken.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const [a, b] = await Promise.all([
      validarQr("condo-1", "conserje-1", token),
      validarQr("condo-1", "conserje-1", token),
    ]);

    const resultados = [a.resultado, b.resultado].sort();
    expect(resultados).toEqual([ResultadoAcceso.AUTORIZADO, ResultadoAcceso.RECHAZADO]);
    expect([a, b].find((r) => r.resultado === ResultadoAcceso.RECHAZADO)?.motivo).toMatch(/ya fue utilizado/i);
    // solo el escaneo ganador marca la visita como usada
    expect(updateVisita).toHaveBeenCalledTimes(1);
  });

  it("el limite de usos va dentro de la condicion de la base de datos", async () => {
    const { token, registro } = visitaDeUnUso("qr-limite");
    findUnique.mockResolvedValueOnce(registro);

    await validarQr("condo-1", "conserje-1", token);

    expect(updateManyToken).toHaveBeenCalledWith({
      where: { id: "qr-limite", revocado: false, usosRealizados: { lt: 1 } },
      data: { usosRealizados: { increment: 1 } },
    });
  });

  it("no valida el QR de otro condominio", async () => {
    const { token, registro } = visitaDeUnUso("qr-ajeno");
    findUnique.mockResolvedValueOnce({ ...registro, visita: { ...registro.visita, condominioId: "condo-2" } });

    const resultado = await validarQr("condo-1", "conserje-1", token);

    expect(resultado.resultado).toBe(ResultadoAcceso.RECHAZADO);
    expect(resultado.motivo).toMatch(/no reconocido/i);
    expect(updateManyToken).not.toHaveBeenCalled();
  });

  it("rechaza el QR de un residente cuya cuenta fue deshabilitada", async () => {
    const expiraEn = new Date(Date.now() + 60_000);
    const token = signQrToken("qr-baja", "RESIDENTE", expiraEn);
    findUnique.mockResolvedValueOnce({
      id: "qr-baja",
      tipo: TipoQrToken.RESIDENTE,
      revocado: false,
      expiraEn,
      usosMaximos: null,
      usosRealizados: 0,
      usuario: { ...persona(), activo: false },
      visita: null,
    });

    const resultado = await validarQr("condo-1", "conserje-1", token);

    expect(resultado.resultado).toBe(ResultadoAcceso.RECHAZADO);
    expect(resultado.motivo).toMatch(/deshabilitada/i);
    expect(updateManyToken).not.toHaveBeenCalled();
  });
});
