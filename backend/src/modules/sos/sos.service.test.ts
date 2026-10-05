import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Rol, TipoEmergenciaSos } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    usuario: { findUnique: vi.fn(), findMany: vi.fn() },
    alertaSos: { create: vi.fn() },
  },
}));

vi.mock("../notificaciones/notificaciones.service", () => ({
  crearNotificacionesMasivas: vi.fn(),
}));

import { prisma } from "../../lib/prisma";
import { crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { crearAlerta } from "./sos.service";

const findUniqueUsuario = prisma.usuario.findUnique as unknown as Mock;
const findManyUsuario = prisma.usuario.findMany as unknown as Mock;
const crearAlertaSos = prisma.alertaSos.create as unknown as Mock;
const notificarMasivo = crearNotificacionesMasivas as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

// Boton de panico (ver BotonSOS.tsx): si esto notifica a la gente
// equivocada, o a nadie, el feature no cumple su unico proposito.
describe("crearAlerta (SOS)", () => {
  it("notifica solo a ADMIN y CONSERJE del condominio, nunca a otros residentes", async () => {
    findUniqueUsuario.mockResolvedValue({
      nombre: "Roberto",
      apellido: "Residente",
      departamento: { numero: "101", torre: { nombre: "Torre A" } },
    });
    crearAlertaSos.mockResolvedValue({ id: "alerta-1" });
    findManyUsuario.mockResolvedValue([{ id: "admin-1" }, { id: "conserje-1" }]);

    await crearAlerta("condo-1", "residente-1", TipoEmergenciaSos.BOMBEROS);

    expect(findManyUsuario).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ condominioId: "condo-1", rol: { in: [Rol.ADMIN, Rol.CONSERJE] } }),
      })
    );
    expect(notificarMasivo).toHaveBeenCalledWith(
      ["admin-1", "conserje-1"],
      expect.objectContaining({
        tipo: "SOS_BOMBEROS",
        entidadTipo: "AlertaSos",
        entidadId: "alerta-1",
      })
    );
  });

  it("incluye el nombre y la unidad del residente en el mensaje de la alerta", async () => {
    findUniqueUsuario.mockResolvedValue({
      nombre: "Roberto",
      apellido: "Residente",
      departamento: { numero: "101", torre: { nombre: "Torre A" } },
    });
    crearAlertaSos.mockResolvedValue({ id: "alerta-2" });
    findManyUsuario.mockResolvedValue([{ id: "admin-1" }]);

    await crearAlerta("condo-1", "residente-1", TipoEmergenciaSos.AMBULANCIA);

    expect(notificarMasivo).toHaveBeenCalledWith(
      ["admin-1"],
      expect.objectContaining({
        mensaje: "Roberto Residente (Torre A 101) activó una alerta de Ambulancia.",
      })
    );
  });

  it("no revienta si no hay nadie que notificar (condominio sin admin/conserje activo)", async () => {
    findUniqueUsuario.mockResolvedValue({ nombre: "Roberto", apellido: "Residente", departamento: null });
    crearAlertaSos.mockResolvedValue({ id: "alerta-3" });
    findManyUsuario.mockResolvedValue([]);

    await expect(crearAlerta("condo-1", "residente-1", TipoEmergenciaSos.CARABINEROS)).resolves.toBeDefined();
    expect(notificarMasivo).toHaveBeenCalledWith([], expect.anything());
  });
});
