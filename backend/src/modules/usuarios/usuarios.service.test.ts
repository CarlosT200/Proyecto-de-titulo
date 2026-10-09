import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import bcrypt from "bcryptjs";
import { Rol } from "@prisma/client";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    usuario: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    departamento: { findFirst: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma";
import { actualizarUsuario, crearUsuario, listarUsuarios, restablecerPassword } from "./usuarios.service";
import { NotFoundError } from "../../lib/errors";

const findUnique = prisma.usuario.findUnique as unknown as Mock;
const findFirst = prisma.usuario.findFirst as unknown as Mock;
const findMany = prisma.usuario.findMany as unknown as Mock;
const create = prisma.usuario.create as unknown as Mock;
const update = prisma.usuario.update as unknown as Mock;
const unidadFindFirst = prisma.departamento.findFirst as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("crearUsuario", () => {
  it("la cuenta nueva queda con la obligacion de cambiar la contraseña temporal", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "u-9" });

    await crearUsuario("condo-1", {
      nombre: "Ana",
      apellido: "Soto",
      email: "Ana@Correo.cl",
      password: "temporal-123",
      rol: Rol.RESIDENTE,
    });

    const { data } = create.mock.calls[0][0];
    expect(data.debeCambiarPassword).toBe(true);
    expect(data.email).toBe("ana@correo.cl");
    expect(await bcrypt.compare("temporal-123", data.passwordHash)).toBe(true);
  });
});

describe("restablecerPassword", () => {
  it("deja una contraseña temporal nueva y obliga a cambiarla", async () => {
    findFirst.mockResolvedValue({ id: "u-1" });
    update.mockResolvedValue({ id: "u-1", nombre: "Ana", apellido: "Soto" });

    await restablecerPassword("condo-1", "u-1", "otra-temporal-456");

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "u-1", condominioId: "condo-1" } }));
    const { data } = update.mock.calls[0][0];
    expect(data.debeCambiarPassword).toBe(true);
    // las sesiones que la persona tenia abiertas dejan de valer
    expect(data.passwordCambiadaEn).toBeInstanceOf(Date);
    expect(await bcrypt.compare("otra-temporal-456", data.passwordHash)).toBe(true);
  });

  it("no toca cuentas de otro condominio", async () => {
    findFirst.mockResolvedValue(null);
    await expect(restablecerPassword("condo-1", "ajeno", "otra-temporal-456")).rejects.toThrow(NotFoundError);
    expect(update).not.toHaveBeenCalled();
  });
});

// RNF-07: conserjeria necesita nombre y unidad para registrar encomiendas, no correos ni telefonos.
describe("listarUsuarios", () => {
  it("al conserje le entrega solo nombre y unidad, sin correo ni telefono", async () => {
    findMany.mockResolvedValue([]);
    await listarUsuarios("condo-1", { rol: Rol.RESIDENTE }, Rol.CONSERJE);
    const { select } = findMany.mock.calls[0][0];
    expect(select).not.toHaveProperty("email");
    expect(select).not.toHaveProperty("telefono");
    expect(select).toHaveProperty("nombre");
    expect(select).toHaveProperty("departamento");
  });

  it("a la administracion le entrega el detalle completo", async () => {
    findMany.mockResolvedValue([]);
    await listarUsuarios("condo-1", {}, Rol.ADMIN);
    const { select } = findMany.mock.calls[0][0];
    expect(select).toHaveProperty("email");
    expect(select).toHaveProperty("telefono");
  });
});

describe("unidad de la cuenta", () => {
  it("al crear, rechaza una unidad de otro condominio", async () => {
    findUnique.mockResolvedValue(null);
    unidadFindFirst.mockResolvedValue(null);
    await expect(
      crearUsuario("condo-1", { nombre: "Ana", apellido: "Soto", email: "ana@x.cl", password: "temporal-123", rol: Rol.RESIDENTE, departamentoId: "depto-ajeno" })
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(unidadFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "depto-ajeno", condominioId: "condo-1" } }));
    expect(create).not.toHaveBeenCalled();
  });

  it("al editar, rechaza una unidad de otro condominio y no guarda nada", async () => {
    findFirst.mockResolvedValue({ id: "u-1" });
    unidadFindFirst.mockResolvedValue(null);
    await expect(actualizarUsuario("condo-1", "u-1", { departamentoId: "depto-ajeno" })).rejects.toBeInstanceOf(NotFoundError);
    expect(update).not.toHaveBeenCalled();
  });

  it("al editar, acepta una unidad del mismo condominio o quitarla", async () => {
    findFirst.mockResolvedValue({ id: "u-1" });
    unidadFindFirst.mockResolvedValue({ id: "depto-1" });
    update.mockResolvedValue({ id: "u-1" });
    await actualizarUsuario("condo-1", "u-1", { departamentoId: "depto-1", telefono: "+56 9 1234 5678" });
    await actualizarUsuario("condo-1", "u-1", { departamentoId: null });
    expect(update).toHaveBeenCalledTimes(2);
    expect(unidadFindFirst).toHaveBeenCalledTimes(1);
  });
});
