import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoMulta, Rol } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    multa: { findFirst: vi.fn(), updateMany: vi.fn() },
    usuario: { findMany: vi.fn() },
  },
}));
vi.mock("../notificaciones/notificaciones.service", () => ({
  crearNotificacion: vi.fn(),
  crearNotificacionesMasivas: vi.fn(),
}));

import { prisma } from "../../lib/prisma";
import { crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { apelarMulta } from "./multas.service";
import { apelarMultaSchema } from "./multas.schema";
import { ConflictError, NotFoundError } from "../../lib/errors";

const buscar = prisma.multa.findFirst as unknown as Mock;
const actualizar = prisma.multa.updateMany as unknown as Mock;
const admins = prisma.usuario.findMany as unknown as Mock;
const avisar = crearNotificacionesMasivas as unknown as Mock;

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
    expect(llamada.where).toEqual({ id: "m-1", usuarioId: "u-1", estado: EstadoMulta.PENDIENTE });
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
