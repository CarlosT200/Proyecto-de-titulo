import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import jwt from "jsonwebtoken";
import { Rol } from "@prisma/client";
import type { Request, Response } from "express";

vi.mock("../lib/prisma", () => ({
  prisma: { usuario: { findUnique: vi.fn() } },
}));

import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { signAuthToken } from "../lib/jwt";
import { requireAuth, requireRole } from "./auth";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

const findUsuario = prisma.usuario.findUnique as unknown as Mock;

function pedido(token?: string): Request {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} } as unknown as Request;
}

async function ejecutar(req: Request) {
  const next = vi.fn();
  await requireAuth(req, {} as Response, next);
  return next;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// RNF-04 / RNF-07: la sesion solo vale mientras la cuenta siga existiendo y activa.
describe("requireAuth", () => {
  const token = () => signAuthToken({ sub: "u-1", rol: Rol.CONSERJE, condominioId: "condo-1" });

  it("deja pasar a una cuenta activa y toma rol y condominio de la base de datos", async () => {
    findUsuario.mockResolvedValue({ activo: true, rol: Rol.ADMIN, condominioId: "condo-9" });
    const req = pedido(token());

    const next = await ejecutar(req);

    expect(next).toHaveBeenCalledWith();
    // aunque el token diga CONSERJE / condo-1, manda lo que dice la base de datos
    expect(req.auth).toEqual({ sub: "u-1", rol: Rol.ADMIN, condominioId: "condo-9" });
  });

  it("corta de inmediato a una cuenta deshabilitada, aunque su token siga vigente", async () => {
    findUsuario.mockResolvedValue({ activo: false, rol: Rol.CONSERJE, condominioId: "condo-1" });
    const next = await ejecutar(pedido(token()));
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/cuenta no está disponible/);
  });

  it("rechaza un token de una cuenta que ya no existe", async () => {
    findUsuario.mockResolvedValue(null);
    const next = await ejecutar(pedido(token()));
    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
  });

  it("rechaza pedidos sin token, con token manipulado o vencido, sin consultar la base de datos", async () => {
    const vencido = jwt.sign({ sub: "u-1", rol: "ADMIN", condominioId: "c" }, env.jwtSecret, { expiresIn: -10 });
    const manipulado = jwt.sign({ sub: "u-1", rol: "ADMIN", condominioId: "c" }, "otra-clave", { expiresIn: 60 });

    for (const req of [pedido(), pedido(vencido), pedido(manipulado)]) {
      const next = await ejecutar(req);
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    }
    expect(findUsuario).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  it("solo deja pasar a los roles indicados", () => {
    const next = vi.fn();
    const req = { auth: { sub: "u", rol: Rol.RESIDENTE, condominioId: "c" } } as unknown as Request;
    expect(() => requireRole(Rol.ADMIN)(req, {} as Response, next)).toThrow(ForbiddenError);
    expect(next).not.toHaveBeenCalled();
    requireRole(Rol.ADMIN, Rol.RESIDENTE)(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
