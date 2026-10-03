import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    usuario: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma";
import { login } from "./auth.service";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors";

const findUnique = prisma.usuario.findUnique as unknown as Mock;
const findUniqueOrThrow = prisma.usuario.findUniqueOrThrow as unknown as Mock;

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
});

describe("login (HU-01)", () => {
  it("devuelve token y el perfil completo, con unidad y condominio", async () => {
    findUnique.mockResolvedValue(await usuarioEnBd());

    const resultado = await login("residente@habitasmart.cl", "Habita2026!");

    expect(resultado.token).toEqual(expect.any(String));
    expect(resultado.usuario.departamento?.torre?.nombre).toBe("Torre A");
    expect(resultado.usuario.condominio?.nombre).toBe("Condominio Los Alerces");
    expect(resultado.usuario).not.toHaveProperty("passwordHash");
  });

  it("normaliza el correo (mayusculas y espacios) antes de buscar", async () => {
    findUnique.mockResolvedValue(await usuarioEnBd());

    await login("  Residente@HabitaSmart.cl ", "Habita2026!");

    expect(findUnique).toHaveBeenCalledWith({ where: { email: "residente@habitasmart.cl" } });
  });

  it("rechaza una contraseña incorrecta con un mensaje generico", async () => {
    findUnique.mockResolvedValue(await usuarioEnBd());

    await expect(login("residente@habitasmart.cl", "otra")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("no revela si el correo existe: mismo error que contraseña incorrecta", async () => {
    findUnique.mockResolvedValue(null);

    await expect(login("noexiste@habitasmart.cl", "Habita2026!")).rejects.toThrow("Correo o contraseña incorrectos.");
  });

  it("bloquea a una cuenta deshabilitada aunque la contraseña sea correcta", async () => {
    findUnique.mockResolvedValue(await usuarioEnBd(false));

    await expect(login("residente@habitasmart.cl", "Habita2026!")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
