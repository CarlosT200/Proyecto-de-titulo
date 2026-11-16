import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Response } from "express";
import { Rol } from "@prisma/client";

vi.mock("./prisma", () => ({
  prisma: { sesion: { create: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() } },
}));

import { prisma } from "./prisma";
import {
  borrarCookiesDeSesion,
  COOKIE_CSRF,
  COOKIE_SESION,
  crearSesion,
  escribirCookiesDeSesion,
  hashDeToken,
  igualesEnTiempoConstante,
  listarSesionesVigentes,
  opcionesCookieCsrf,
  opcionesCookieSesion,
  registrarUsoDeSesion,
  revocarSesion,
  revocarSesionesDeUsuario,
} from "./sesiones";

const create = prisma.sesion.create as unknown as Mock;
const updateMany = prisma.sesion.updateMany as unknown as Mock;
const findMany = prisma.sesion.findMany as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({ id: "s-1" });
  updateMany.mockResolvedValue({ count: 1 });
  findMany.mockResolvedValue([]);
});

describe("tokens de sesión", () => {
  it("el token es aleatorio, largo y distinto en cada sesión; en la base va solo el hash", async () => {
    const a = await crearSesion({ id: "u-1", rol: Rol.ADMIN }, "Agente");
    const b = await crearSesion({ id: "u-1", rol: Rol.ADMIN }, "Agente");
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(40);
    expect(create.mock.calls[0][0].data.tokenHash).toBe(hashDeToken(a.token));
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain(a.token);
  });

  it("el hash es determinista (SHA-256 en hexadecimal) y no reversible a simple vista", () => {
    expect(hashDeToken("abc")).toBe(hashDeToken("abc"));
    expect(hashDeToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDeToken("abc")).not.toBe(hashDeToken("abd"));
  });

  it("recorta el User-Agent a 200 caracteres y acepta que falte", async () => {
    await crearSesion({ id: "u-1", rol: Rol.ADMIN }, "x".repeat(500));
    expect(create.mock.calls[0][0].data.agente).toHaveLength(200);
    await crearSesion({ id: "u-1", rol: Rol.ADMIN });
    expect(create.mock.calls[1][0].data.agente).toBeNull();
  });

  it("la comparación en tiempo constante distingue largos y contenidos", () => {
    expect(igualesEnTiempoConstante("abc", "abc")).toBe(true);
    expect(igualesEnTiempoConstante("abc", "abd")).toBe(false);
    expect(igualesEnTiempoConstante("abc", "abcd")).toBe(false);
  });
});

describe("cookies", () => {
  const expiraEn = new Date(Date.now() + 3600_000);

  it("la cookie de sesión es HttpOnly, SameSite=Lax, Path=/ y con vencimiento; la CSRF es legible", () => {
    // En las pruebas NODE_ENV no es production, por eso secure es false (en produccion es true).
    expect(opcionesCookieSesion(expiraEn)).toEqual({ httpOnly: true, secure: false, sameSite: "lax", path: "/", expires: expiraEn });
    expect(opcionesCookieCsrf(expiraEn)).toEqual({ httpOnly: false, secure: false, sameSite: "lax", path: "/", expires: expiraEn });
  });

  it("escribir y borrar usan los mismos nombres y atributos (si no, el navegador no las borra)", () => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response & { cookie: Mock; clearCookie: Mock };
    escribirCookiesDeSesion(res, { token: "t", csrfToken: "c", expiraEn });
    expect(res.cookie).toHaveBeenCalledWith(COOKIE_SESION, "t", expect.objectContaining({ httpOnly: true, path: "/" }));
    expect(res.cookie).toHaveBeenCalledWith(COOKIE_CSRF, "c", expect.objectContaining({ httpOnly: false, path: "/" }));

    borrarCookiesDeSesion(res);
    expect(res.clearCookie).toHaveBeenCalledWith(COOKIE_SESION, { httpOnly: true, secure: false, sameSite: "lax", path: "/" });
    expect(res.clearCookie).toHaveBeenCalledWith(COOKIE_CSRF, { httpOnly: false, secure: false, sameSite: "lax", path: "/" });
  });
});

describe("revocación", () => {
  it("revocarSesion solo toca la sesión del propio usuario y devuelve si había algo que revocar", async () => {
    await expect(revocarSesion("u-1", "s-9")).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "s-9", usuarioId: "u-1", revocadaEn: null },
      data: { revocadaEn: expect.any(Date) },
    });
    updateMany.mockResolvedValue({ count: 0 });
    await expect(revocarSesion("u-1", "s-de-otro")).resolves.toBe(false);
  });

  it("revocarSesionesDeUsuario puede conservar la sesión actual", async () => {
    await revocarSesionesDeUsuario("u-1", { exceptoId: "s-actual" });
    expect(updateMany.mock.calls[0][0].where).toEqual({ usuarioId: "u-1", revocadaEn: null, id: { not: "s-actual" } });
    await revocarSesionesDeUsuario("u-1");
    expect(updateMany.mock.calls[1][0].where).toEqual({ usuarioId: "u-1", revocadaEn: null });
  });

  it("listar sesiones vigentes excluye revocadas y vencidas y nunca devuelve el hash ni el token CSRF", async () => {
    await listarSesionesVigentes("u-1");
    const args = findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ usuarioId: "u-1", revocadaEn: null, expiraEn: { gt: expect.any(Date) } });
    expect(args.select).not.toHaveProperty("tokenHash");
    expect(args.select).not.toHaveProperty("csrfToken");
  });

  it("registrarUsoDeSesion actualiza como mucho cada 5 minutos", () => {
    registrarUsoDeSesion({ id: "s-1", ultimoUsoEn: new Date() });
    expect(updateMany).not.toHaveBeenCalled();
    registrarUsoDeSesion({ id: "s-1", ultimoUsoEn: new Date(Date.now() - 6 * 60 * 1000) });
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
