import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Rol } from "@prisma/client";
import type { Request, Response } from "express";

vi.mock("../lib/prisma", () => ({
  prisma: { sesion: { findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) } },
}));

import { prisma } from "../lib/prisma";
import { COOKIE_SESION, hashDeToken } from "../lib/sesiones";
import { requireAuth, requireRole } from "./auth";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";

const findSesion = prisma.sesion.findUnique as unknown as Mock;

const TOKEN = "token-de-prueba-abc";

function respuesta() {
  return { clearCookie: vi.fn() } as unknown as Response & { clearCookie: Mock };
}

function pedido(opciones: { token?: string; metodo?: string; csrf?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (opciones.csrf) headers["x-csrf-token"] = opciones.csrf;
  return {
    method: opciones.metodo ?? "GET",
    cookies: opciones.token ? { [COOKIE_SESION]: opciones.token } : {},
    get: (nombre: string) => headers[nombre.toLowerCase()],
  } as unknown as Request;
}

function sesion(extra: Partial<Record<string, unknown>> = {}, usuario: Partial<Record<string, unknown>> = {}) {
  return {
    id: "s-1",
    usuarioId: "u-1",
    csrfToken: "csrf-1",
    creadaEn: new Date(Date.now() - 60_000),
    ultimoUsoEn: new Date(),
    expiraEn: new Date(Date.now() + 3600_000),
    revocadaEn: null,
    usuario: { activo: true, rol: Rol.CONSERJE, condominioId: "condo-1", passwordCambiadaEn: null, ...usuario },
    ...extra,
  };
}

async function ejecutar(req: Request, res = respuesta()) {
  const next = vi.fn();
  await requireAuth(req, res, next);
  return { next, res };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// RNF-04 / RNF-07: la sesion solo vale mientras exista, no este revocada ni vencida, y la cuenta
// siga activa. Todo se decide con lo que hay en la base, no con lo que trae el cliente.
describe("requireAuth (sesión por cookie)", () => {
  it("deja pasar una sesión vigente, busca por el HASH del token y toma rol/condominio de la base", async () => {
    findSesion.mockResolvedValue(sesion({}, { rol: Rol.ADMIN, condominioId: "condo-9" }));
    const req = pedido({ token: TOKEN });

    const { next } = await ejecutar(req);

    expect(next).toHaveBeenCalledWith();
    expect(findSesion).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashDeToken(TOKEN) } }));
    expect(req.auth).toEqual({ sub: "u-1", rol: Rol.ADMIN, condominioId: "condo-9", sesionId: "s-1" });
  });

  it("rechaza pedidos sin cookie sin consultar la base", async () => {
    const { next } = await ejecutar(pedido());
    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    expect(findSesion).not.toHaveBeenCalled();
  });

  it("rechaza un token desconocido y borra las cookies", async () => {
    findSesion.mockResolvedValue(null);
    const { next, res } = await ejecutar(pedido({ token: "inventado" }));
    expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it("rechaza una sesión revocada (cerrada desde otro dispositivo o por la administración)", async () => {
    findSesion.mockResolvedValue(sesion({ revocadaEn: new Date() }));
    const { next } = await ejecutar(pedido({ token: TOKEN }));
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/sesión fue cerrada/);
  });

  it("rechaza una sesión vencida aunque exista en la base", async () => {
    findSesion.mockResolvedValue(sesion({ expiraEn: new Date(Date.now() - 1000) }));
    const { next } = await ejecutar(pedido({ token: TOKEN }));
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/expiró/);
  });

  it("corta de inmediato a una cuenta deshabilitada, aunque su sesión siga vigente", async () => {
    findSesion.mockResolvedValue(sesion({}, { activo: false }));
    const { next } = await ejecutar(pedido({ token: TOKEN }));
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/cuenta no está disponible/);
  });

  it("en un método que modifica datos exige la cabecera CSRF de ESTA sesión", async () => {
    findSesion.mockResolvedValue(sesion());

    const sinCabecera = await ejecutar(pedido({ token: TOKEN, metodo: "POST" }));
    expect(sinCabecera.next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);

    const deOtraSesion = await ejecutar(pedido({ token: TOKEN, metodo: "DELETE", csrf: "csrf-de-otra" }));
    expect(deOtraSesion.next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);

    const correcta = await ejecutar(pedido({ token: TOKEN, metodo: "PATCH", csrf: "csrf-1" }));
    expect(correcta.next).toHaveBeenCalledWith();
  });

  it("en GET no exige la cabecera CSRF", async () => {
    findSesion.mockResolvedValue(sesion());
    const { next } = await ejecutar(pedido({ token: TOKEN, metodo: "GET" }));
    expect(next).toHaveBeenCalledWith();
  });
});

describe("requireRole", () => {
  it("solo deja pasar a los roles indicados", () => {
    const next = vi.fn();
    const req = { auth: { sub: "u", rol: Rol.RESIDENTE, condominioId: "c", sesionId: "s" } } as unknown as Request;
    expect(() => requireRole(Rol.ADMIN)(req, {} as Response, next)).toThrow(ForbiddenError);
    expect(next).not.toHaveBeenCalled();
    requireRole(Rol.ADMIN, Rol.RESIDENTE)(req, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
