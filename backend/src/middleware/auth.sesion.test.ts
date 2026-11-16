import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Rol } from "@prisma/client";
import type { Request, Response } from "express";

vi.mock("../lib/prisma", () => ({
  prisma: { sesion: { findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) } },
}));

import { prisma } from "../lib/prisma";
import { COOKIE_SESION, duracionSesionMs } from "../lib/sesiones";
import { requireAuth } from "./auth";
import { UnauthorizedError } from "../lib/errors";

const findSesion = prisma.sesion.findUnique as unknown as Mock;

async function ejecutar() {
  const req = { method: "GET", cookies: { [COOKIE_SESION]: "t" }, get: () => undefined } as unknown as Request;
  const res = { clearCookie: vi.fn() } as unknown as Response;
  const next = vi.fn();
  await requireAuth(req, res, next);
  return next;
}

// Una sesion (aunque dure 30 dias) deja de valer cuando la persona cambia su contraseña o la
// administracion se la restablece. La revocacion explicita ya lo cubre; esta es la defensa
// adicional por fecha, por si una sesion quedara sin revocar.
describe("sesiones y cambio de contraseña", () => {
  const ahora = Date.now();
  const sesionAbiertaHace = (segundos: number, cambiadaHaceSegundos: number | null) => ({
    id: "s-1",
    usuarioId: "u-1",
    csrfToken: "c",
    creadaEn: new Date(ahora - segundos * 1000),
    ultimoUsoEn: new Date(ahora),
    expiraEn: new Date(ahora + 30 * 86400 * 1000),
    revocadaEn: null,
    usuario: {
      activo: true,
      rol: Rol.RESIDENTE,
      condominioId: "c-1",
      passwordCambiadaEn: cambiadaHaceSegundos === null ? null : new Date(ahora - cambiadaHaceSegundos * 1000),
    },
  });

  beforeEach(() => vi.clearAllMocks());

  it("una sesión abierta ANTES de cambiar la contraseña deja de valer", async () => {
    findSesion.mockResolvedValue(sesionAbiertaHace(3600, 60)); // sesion de 1 hora, clave cambiada hace 1 minuto
    const next = await ejecutar();
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/contraseña cambió/);
  });

  it("una sesión abierta DESPUÉS del cambio sigue valiendo", async () => {
    findSesion.mockResolvedValue(sesionAbiertaHace(60, 3600));
    const next = await ejecutar();
    expect(next).toHaveBeenCalledWith();
  });

  it("si la contraseña nunca se cambió, la sesión vale", async () => {
    findSesion.mockResolvedValue(sesionAbiertaHace(86400 * 20, null));
    const next = await ejecutar();
    expect(next).toHaveBeenCalledWith();
  });
});

describe("duración de la sesión según el rol", () => {
  it("los residentes tienen sesión larga y el personal, corta", () => {
    expect(duracionSesionMs(Rol.RESIDENTE)).toBe(30 * 24 * 3600 * 1000);
    expect(duracionSesionMs(Rol.ADMIN)).toBe(8 * 3600 * 1000);
    expect(duracionSesionMs(Rol.CONSERJE)).toBe(8 * 3600 * 1000);
  });
});
