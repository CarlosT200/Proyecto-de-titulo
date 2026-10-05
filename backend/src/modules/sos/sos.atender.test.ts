import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { EstadoAlertaSos, Rol } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: { alertaSos: { updateMany: vi.fn(), findFirst: vi.fn() } },
}));
vi.mock("../notificaciones/notificaciones.service", () => ({
  crearNotificacion: vi.fn(),
  crearNotificacionesMasivas: vi.fn(),
}));

import { prisma } from "../../lib/prisma";
import { crearNotificacion } from "../notificaciones/notificaciones.service";
import { atenderAlerta } from "./sos.service";
import { ConflictError, NotFoundError } from "../../lib/errors";

const actualizar = prisma.alertaSos.updateMany as unknown as Mock;
const buscar = prisma.alertaSos.findFirst as unknown as Mock;
const notificar = crearNotificacion as unknown as Mock;

const ALERTA = {
  id: "a-1",
  usuarioId: "r-1",
  tipo: "AMBULANCIA",
  estado: EstadoAlertaSos.ATENDIDA,
  atendidaEn: new Date("2026-10-04T21:05:00.000Z"),
  usuario: { id: "r-1", nombre: "Roberto", apellido: "Residente" },
  atendidaPor: { id: "c-1", nombre: "Carlos", apellido: "Conserje", rol: Rol.CONSERJE },
};

beforeEach(() => vi.clearAllMocks());

describe("atenderAlerta", () => {
  it("marca la alerta como atendida (solo si seguía activa) y avisa al residente", async () => {
    actualizar.mockResolvedValue({ count: 1 });
    buscar.mockResolvedValue(ALERTA);

    await atenderAlerta("condo-1", "a-1", "c-1", "Se llamó a la ambulancia y se abrió el portón.");

    const { where, data } = actualizar.mock.calls[0][0];
    expect(where).toEqual({ id: "a-1", condominioId: "condo-1", estado: EstadoAlertaSos.ACTIVA });
    expect(data).toMatchObject({ estado: EstadoAlertaSos.ATENDIDA, atendidaPorId: "c-1", observacion: "Se llamó a la ambulancia y se abrió el portón." });
    expect(notificar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: "r-1", titulo: "Tu alerta SOS fue atendida" })
    );
    expect(notificar.mock.calls[0][0].mensaje).toMatch(/^Carlos \(conserjería\) atendió tu alerta de Ambulancia a las \d\d:\d\d\.$/);
  });

  it("si ya estaba atendida, informa por quién y a qué hora, sin volver a notificar", async () => {
    actualizar.mockResolvedValue({ count: 0 });
    buscar.mockResolvedValue(ALERTA);

    const intento = atenderAlerta("condo-1", "a-1", "otro-conserje");
    await expect(intento).rejects.toThrow(ConflictError);
    await expect(intento).rejects.toThrow("Esta alerta ya fue atendida por Carlos Conserje a las 18:05.");
    expect(notificar).not.toHaveBeenCalled();
  });

  it("una alerta inexistente o de otro condominio da 404", async () => {
    actualizar.mockResolvedValue({ count: 0 });
    buscar.mockResolvedValue(null);
    await expect(atenderAlerta("condo-1", "nada", "c-1")).rejects.toThrow(NotFoundError);
  });
});
