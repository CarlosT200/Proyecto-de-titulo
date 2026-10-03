import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Request } from "express";

vi.mock("../../lib/prisma", () => ({
  prisma: { auditoria: { create: vi.fn(), findMany: vi.fn() } },
}));

import { prisma } from "../../lib/prisma";
import { auditar, listarAuditoria, registrarAuditoria } from "./auditoria.service";

const crear = prisma.auditoria.create as unknown as Mock;
const listar = prisma.auditoria.findMany as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

// RNF-06: trazabilidad de acciones administrativas.
describe("registrarAuditoria", () => {
  it("guarda quien, que y sobre cual registro", async () => {
    crear.mockResolvedValue({});
    await registrarAuditoria({
      condominioId: "condo-1",
      usuarioId: "admin-1",
      accion: "ELIMINAR",
      entidad: "Comunicado",
      entidadId: "com-1",
      descripcion: 'Eliminó el comunicado "Corte de agua".',
    });
    expect(crear).toHaveBeenCalledWith({
      data: {
        condominioId: "condo-1",
        usuarioId: "admin-1",
        accion: "ELIMINAR",
        entidad: "Comunicado",
        entidadId: "com-1",
        descripcion: 'Eliminó el comunicado "Corte de agua".',
      },
    });
  });

  it("si la base de datos falla, no rompe la accion que ya se hizo", async () => {
    crear.mockRejectedValue(new Error("sin conexion"));
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      registrarAuditoria({ condominioId: "c", usuarioId: "u", accion: "CREAR", entidad: "Multa", descripcion: "x" })
    ).resolves.toBeUndefined();
    // y deja constancia en el log del servidor
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });
});

describe("auditar", () => {
  it("toma el condominio y la persona de la sesion", async () => {
    crear.mockResolvedValue({});
    const req = { auth: { sub: "admin-9", rol: "ADMIN", condominioId: "condo-9" } } as unknown as Request;
    await auditar(req, "CREAR", "Multa", "Registró una multa.", "multa-1");
    expect(crear).toHaveBeenCalledWith({
      data: expect.objectContaining({ condominioId: "condo-9", usuarioId: "admin-9", entidad: "Multa", entidadId: "multa-1" }),
    });
  });
});

describe("listarAuditoria", () => {
  it("solo trae el condominio de la sesion, lo mas reciente primero y con tope de 500", async () => {
    listar.mockResolvedValue([]);
    await listarAuditoria("condo-1", { entidad: "Multa", limite: 9999 });
    expect(listar).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { condominioId: "condo-1", entidad: "Multa" },
        orderBy: { createdAt: "desc" },
        take: 500,
      })
    );
  });
});
