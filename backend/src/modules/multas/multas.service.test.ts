import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoMulta, Rol } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    multa: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    usuario: { findMany: vi.fn() },
  },
}));
vi.mock("../notificaciones/notificaciones.service", () => ({
  crearNotificacion: vi.fn(),
  crearNotificacionesMasivas: vi.fn(),
}));

import { prisma } from "../../lib/prisma";
import { crearNotificacion, crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { actualizarMulta, apelarMulta, resolverApelacion } from "./multas.service";
import { apelarMultaSchema, resolverApelacionSchema } from "./multas.schema";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors";

const buscar = prisma.multa.findFirst as unknown as Mock;
const actualizar = prisma.multa.updateMany as unknown as Mock;
const admins = prisma.usuario.findMany as unknown as Mock;
const avisar = crearNotificacionesMasivas as unknown as Mock;
const avisarUno = crearNotificacion as unknown as Mock;
const actualizarUna = prisma.multa.update as unknown as Mock;

const MULTA = {
  id: "m-1",
  condominioId: "condo-1",
  motivo: "Ruido excesivo",
  usuario: { nombre: "Roberto", apellido: "Residente" },
};

beforeEach(() => {
  vi.clearAllMocks();
  buscar.mockResolvedValue(MULTA);
  actualizar.mockResolvedValue({ count: 1 });
  admins.mockResolvedValue([{ id: "a-1" }, { id: "a-2" }]);
});

describe("apelarMulta", () => {
  it("pasa la multa pendiente a apelada con la explicación y avisa a la administración", async () => {
    const r = await apelarMulta("u-1", "m-1", "Estaba de viaje esa noche.");

    expect(r).toEqual({ motivo: "Ruido excesivo" });
    const llamada = actualizar.mock.calls[0][0];
    // la condición "sigue pendiente" va en el mismo UPDATE (atómico) y solo sobre una multa propia
    expect(llamada.where).toEqual({ id: "m-1", usuarioId: "u-1", estado: EstadoMulta.PENDIENTE, apeladaEn: null });
    expect(llamada.data).toMatchObject({ estado: EstadoMulta.APELADA, apelacion: "Estaba de viaje esa noche." });
    expect(llamada.data.apeladaEn).toBeInstanceOf(Date);

    expect(admins.mock.calls[0][0].where).toEqual({ condominioId: "condo-1", rol: Rol.ADMIN, activo: true });
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(avisar.mock.calls[0][0]).toEqual(["a-1", "a-2"]);
    expect(avisar.mock.calls[0][1]).toMatchObject({
      tipo: "MULTA",
      titulo: "Multa apelada",
      mensaje: 'Roberto Residente apeló la multa "Ruido excesivo".',
      entidadTipo: "Multa",
      entidadId: "m-1",
    });
  });

  it("no deja apelar la multa de otra persona (404, sin tocar nada)", async () => {
    buscar.mockResolvedValue(null);
    await expect(apelarMulta("u-9", "m-1", "No es mía, no corresponde.")).rejects.toBeInstanceOf(NotFoundError);
    expect(buscar.mock.calls[0][0].where).toEqual({ id: "m-1", usuarioId: "u-9" });
    expect(actualizar).not.toHaveBeenCalled();
    expect(avisar).not.toHaveBeenCalled();
  });

  it("una multa rechazada vuelve a pendiente pero no se puede apelar de nuevo, y se explica", async () => {
    actualizar.mockResolvedValue({ count: 0 });
    buscar.mockResolvedValueOnce(MULTA).mockResolvedValueOnce({ estado: EstadoMulta.PENDIENTE, apeladaEn: new Date() });
    await expect(apelarMulta("u-1", "m-1", "Quiero apelar de nuevo.")).rejects.toThrow("ya fue apelada y la administración respondió");
    expect(avisar).not.toHaveBeenCalled();
  });

  it("responde 409 si la multa ya no está pendiente (ya apelada, pagada o anulada) y no avisa", async () => {
    actualizar.mockResolvedValue({ count: 0 });
    await expect(apelarMulta("u-1", "m-1", "Quiero apelar de nuevo.")).rejects.toBeInstanceOf(ConflictError);
    expect(avisar).not.toHaveBeenCalled();
  });
});

describe("apelarMultaSchema", () => {
  it("exige una explicación de entre 10 y 500 caracteres y limpia los espacios", () => {
    expect(apelarMultaSchema.parse({ motivo: "   Estaba de viaje.   " }).motivo).toBe("Estaba de viaje.");
    expect(apelarMultaSchema.safeParse({ motivo: "corto" }).success).toBe(false);
    expect(apelarMultaSchema.safeParse({ motivo: "          " }).success).toBe(false);
    expect(apelarMultaSchema.safeParse({ motivo: "a".repeat(501) }).success).toBe(false);
    expect(apelarMultaSchema.safeParse({}).success).toBe(false);
  });
});

describe("resolverApelacion", () => {
  beforeEach(() => {
    buscar.mockResolvedValue({ id: "m-1", usuarioId: "u-1", motivo: "Ruido excesivo" });
  });

  it("aceptar anula la multa, guarda la respuesta y se la avisa al residente", async () => {
    const r = await resolverApelacion("condo-1", "m-1", { decision: "ACEPTADA", respuesta: "Se comprobó que el departamento estaba vacío." });

    expect(r).toEqual({ motivo: "Ruido excesivo", aceptada: true });
    const llamada = actualizar.mock.calls[0][0];
    // solo se resuelve una multa que sigue apelada (atómico) y del condominio de quien responde
    expect(llamada.where).toEqual({ id: "m-1", condominioId: "condo-1", estado: EstadoMulta.APELADA });
    expect(llamada.data).toMatchObject({ estado: EstadoMulta.ANULADA, apelacionAceptada: true, respuesta: "Se comprobó que el departamento estaba vacío." });
    expect(llamada.data.respondidaEn).toBeInstanceOf(Date);
    expect(avisarUno.mock.calls[0][0]).toMatchObject({
      usuarioId: "u-1",
      titulo: "Apelación aceptada",
      mensaje: 'La administración aceptó tu apelación: la multa "Ruido excesivo" quedó anulada. Respuesta: Se comprobó que el departamento estaba vacío.',
      entidadTipo: "Multa",
      entidadId: "m-1",
    });
  });

  it("rechazar deja la multa pendiente y lo avisa con la respuesta", async () => {
    const r = await resolverApelacion("condo-1", "m-1", { decision: "RECHAZADA", respuesta: "Hay dos reclamos de vecinos con hora." });
    expect(r.aceptada).toBe(false);
    expect(actualizar.mock.calls[0][0].data).toMatchObject({ estado: EstadoMulta.PENDIENTE, apelacionAceptada: false });
    expect(avisarUno.mock.calls[0][0]).toMatchObject({ titulo: "Apelación rechazada" });
    expect(avisarUno.mock.calls[0][0].mensaje).toContain("sigue pendiente. Respuesta: Hay dos reclamos de vecinos con hora.");
  });

  it("si ya estaba resuelta (otra persona respondió primero) responde 409 y no avisa", async () => {
    actualizar.mockResolvedValue({ count: 0 });
    await expect(resolverApelacion("condo-1", "m-1", { decision: "ACEPTADA", respuesta: "Respuesta duplicada aquí." })).rejects.toBeInstanceOf(ConflictError);
    expect(avisarUno).not.toHaveBeenCalled();
  });

  it("una multa de otro condominio responde 404 sin tocar nada", async () => {
    buscar.mockResolvedValue(null);
    await expect(resolverApelacion("condo-2", "m-1", { decision: "ACEPTADA", respuesta: "No es de este condominio." })).rejects.toBeInstanceOf(NotFoundError);
    expect(buscar.mock.calls[0][0].where).toEqual({ id: "m-1", condominioId: "condo-2" });
    expect(actualizar).not.toHaveBeenCalled();
  });
});

describe("actualizarMulta con una apelación pendiente", () => {
  it("no deja cambiar el estado de una multa apelada sin responder la apelación (422)", async () => {
    buscar.mockResolvedValue({ id: "m-1", usuarioId: "u-1", estado: EstadoMulta.APELADA });
    await expect(actualizarMulta("condo-1", "m-1", { estado: EstadoMulta.ANULADA })).rejects.toBeInstanceOf(AppError);
    expect(actualizarUna).not.toHaveBeenCalled();
  });

  it("los demás cambios de estado siguen igual y avisan al residente", async () => {
    buscar.mockResolvedValue({ id: "m-1", usuarioId: "u-1", estado: EstadoMulta.PENDIENTE });
    actualizarUna.mockResolvedValue({ id: "m-1" });
    await actualizarMulta("condo-1", "m-1", { estado: EstadoMulta.PAGADA });
    expect(avisarUno.mock.calls[0][0].mensaje).toBe("Tu multa cambió de estado a Pagada.");
  });
});

describe("resolverApelacionSchema", () => {
  it("exige la decisión y una respuesta de entre 10 y 500 caracteres", () => {
    expect(resolverApelacionSchema.parse({ decision: "ACEPTADA", respuesta: "  Se acepta por falta de pruebas.  " }).respuesta).toBe("Se acepta por falta de pruebas.");
    expect(resolverApelacionSchema.safeParse({ decision: "TAL VEZ", respuesta: "Respuesta suficiente." }).success).toBe(false);
    expect(resolverApelacionSchema.safeParse({ decision: "RECHAZADA", respuesta: "corta" }).success).toBe(false);
    expect(resolverApelacionSchema.safeParse({ decision: "RECHAZADA" }).success).toBe(false);
    expect(resolverApelacionSchema.safeParse({ decision: "RECHAZADA", respuesta: "a".repeat(501) }).success).toBe(false);
  });
});
