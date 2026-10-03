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
import { requireAuth } from "./auth";
import { UnauthorizedError } from "../lib/errors";

const findUsuario = prisma.usuario.findUnique as unknown as Mock;

async function ejecutar(token: string) {
  const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
  const next = vi.fn();
  await requireAuth(req, {} as Response, next);
  return next;
}

// Un token (aunque dure 30 dias) deja de valer cuando la persona cambia su contraseña o la
// administracion se la restablece: una sesion robada o abierta en un equipo ajeno queda fuera.
describe("sesiones y cambio de contraseña", () => {
  const ahora = Math.floor(Date.now() / 1000);
  const tokenEmitidoHace = (segundos: number) =>
    jwt.sign({ sub: "u-1", rol: Rol.RESIDENTE, condominioId: "c-1", iat: ahora - segundos }, env.jwtSecret, { expiresIn: "30d" });
  const cuenta = (cambiadaHaceSegundos: number | null) => ({
    activo: true,
    rol: Rol.RESIDENTE,
    condominioId: "c-1",
    passwordCambiadaEn: cambiadaHaceSegundos === null ? null : new Date((ahora - cambiadaHaceSegundos) * 1000),
  });

  beforeEach(() => vi.clearAllMocks());

  it("un token emitido ANTES de cambiar la contraseña deja de valer", async () => {
    findUsuario.mockResolvedValue(cuenta(60)); // la clave cambio hace 1 minuto
    const next = await ejecutar(tokenEmitidoHace(3600)); // el token tiene 1 hora
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/contraseña cambió/);
  });

  it("un token emitido DESPUES del cambio sigue valiendo", async () => {
    findUsuario.mockResolvedValue(cuenta(3600)); // la clave cambio hace 1 hora
    const next = await ejecutar(tokenEmitidoHace(60)); // el token tiene 1 minuto
    expect(next).toHaveBeenCalledWith();
  });

  it("si la contraseña nunca se cambio, el token vale", async () => {
    findUsuario.mockResolvedValue(cuenta(null));
    const next = await ejecutar(tokenEmitidoHace(86400 * 20));
    expect(next).toHaveBeenCalledWith();
  });
});

describe("duracion de la sesion segun el rol", () => {
  const duracion = (rol: Rol) => {
    const payload = jwt.decode(signAuthToken({ sub: "u", rol, condominioId: "c" })) as { iat: number; exp: number };
    return payload.exp - payload.iat;
  };

  it("los residentes tienen sesion larga y el personal, corta", () => {
    expect(duracion(Rol.RESIDENTE)).toBe(30 * 24 * 3600);
    expect(duracion(Rol.ADMIN)).toBe(8 * 3600);
    expect(duracion(Rol.CONSERJE)).toBe(8 * 3600);
  });
});
