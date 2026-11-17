import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    usuario: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    sesion: { create: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma";
import { hashDeToken } from "../../lib/sesiones";
import { login } from "./auth.service";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors";

const findUnique = prisma.usuario.findUnique as unknown as Mock;
const findUniqueOrThrow = prisma.usuario.findUniqueOrThrow as unknown as Mock;
const crearSesionEnBd = prisma.sesion.create as unknown as Mock;

const PERFIL = {
  id: "u-1",
  email: "residente@habitasmart.cl",
  nombre: "Roberto",
  apellido: "Residente",
  rol: "RESIDENTE",
  condominioId: "c-1",
  departamentoId: "d-1",
  telefono: null,
  fotoUrl: null,
  condominio: { id: "c-1", nombre: "Condominio Los Alerces" },
  departamento: { id: "d-1", numero: "101", torre: { nombre: "Torre A" } },
};

async function usuarioEnBd(activo = true) {
  return {
    ...PERFIL,
    activo,
    // costo 4: suficiente para el test y mucho mas rapido que el 12 de produccion.
    passwordHash: await bcrypt.hash("Habita2026!", 4),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findUniqueOrThrow.mockResolvedValue(PERFIL);
  crearSesionEnBd.mockResolvedValue({ id: "s-1" });
});

describe("login (HU-01)", () => {
  it("devuelve el perfil completo (con unidad y condominio) y una sesión nueva; el perfil no trae token ni hash", async () => {
    findUnique.mockResolvedValue(await usuarioEnBd());

    const resultado = await login("residente@habitasmart.cl", "Habita2026!", "Mozilla/5.0 (prueba)");

    expect(resultado.usuario.departamento?.torre?.nombre).toBe("Torre A");
    expect(resultado.usuario.condominio?.nombre).toBe("Condominio Los Alerces");
    expect(resultado.usuario).not.toHaveProperty("passwordHash");
    expect(resultado.usuario).not.toHaveProperty("token");
    expect(resultado.sesion.token).toEqual(expect.any(String));
    expect(resultado.sesion.csrfToken).toEqual(expect.any(String));
    expect(resultado.sesion.token).not.toBe(resultado.sesion.csrfToken);
  });

  it("guarda en la base SOLO el hash del token (nunca el token), con vencimiento y agente", async () => {
    findUnique.mockResolvedValue(await usuarioEnBd());

    const { sesion } = await login("residente@habitasmart.cl", "Habita2026!", "Mozilla/5.0 (prueba)");

    const { data } = crearSesionEnBd.mock.calls[0][0];
    expect(data.usuarioId).toBe("u-1");
    expect(data.tokenHash).toBe(hashDeToken(sesion.token));
    expect(data.tokenHash).not.toBe(sesion.token);
    expect(data.csrfToken).toBe(sesion.csrfToken);
    expect(data.agente).toBe("Mozilla/5.0 (prueba)");
    // residente: 30 dias
    expect(data.expiraEn.getTime() - Date.now()).toBeGreaterThan(29 * 86400 * 1000);
  });

  it("cada inicio de sesión genera un token distinto", async () => {
    findUnique.mockResolvedValue(await usuarioEnBd());
    const a = await login("residente@habitasmart.cl", "Habita2026!");
    const b = await login("residente@habitasmart.cl", "Habita2026!");
    expect(a.sesion.token).not.toBe(b.sesion.token);
  });

  it("normaliza el correo (mayúsculas y espacios) antes de buscar", async () => {
    findUnique.mockResolvedValue(await usuarioEnBd());

    await login("  Residente@HabitaSmart.cl ", "Habita2026!");

    expect(findUnique).toHaveBeenCalledWith({ where: { email: "residente@habitasmart.cl" } });
  });

  it("rechaza una contraseña incorrecta con un mensaje genérico y no crea sesión", async () => {
    findUnique.mockResolvedValue(await usuarioEnBd());

    await expect(login("residente@habitasmart.cl", "otra")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(crearSesionEnBd).not.toHaveBeenCalled();
  });

  it("no revela si el correo existe: mismo error que contraseña incorrecta", async () => {
    findUnique.mockResolvedValue(null);

    await expect(login("noexiste@habitasmart.cl", "Habita2026!")).rejects.toThrow("Correo o contraseña incorrectos.");
  });

  it("bloquea a una cuenta deshabilitada aunque la contraseña sea correcta", async () => {
    findUnique.mockResolvedValue(await usuarioEnBd(false));

    await expect(login("residente@habitasmart.cl", "Habita2026!")).rejects.toBeInstanceOf(ForbiddenError);
    expect(crearSesionEnBd).not.toHaveBeenCalled();
  });
});
