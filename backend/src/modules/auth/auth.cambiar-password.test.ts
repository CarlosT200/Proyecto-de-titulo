import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    usuario: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma";
import { cambiarPassword } from "./auth.service";
import { ConflictError, UnauthorizedError } from "../../lib/errors";

const findUniqueOrThrow = prisma.usuario.findUniqueOrThrow as unknown as Mock;
const update = prisma.usuario.update as unknown as Mock;

beforeEach(async () => {
  vi.clearAllMocks();
  // costo 4: suficiente para el test y mucho mas rapido que el 12 de produccion
  findUniqueOrThrow.mockResolvedValue({ id: "u-1", passwordHash: await bcrypt.hash("temporal-123", 4) });
  update.mockResolvedValue({ id: "u-1", debeCambiarPassword: false });
});

// Las cuentas nuevas y las restablecidas por la administracion arrancan con una contraseña
// temporal que conoce otra persona: al elegir la propia deja de ser obligatorio cambiarla.
describe("cambiarPassword", () => {
  it("guarda la clave nueva (cifrada) y apaga la marca de cambio obligatorio", async () => {
    await cambiarPassword("u-1", "temporal-123", "mi-clave-personal");

    const { data } = update.mock.calls[0][0];
    expect(data.debeCambiarPassword).toBe(false);
    expect(data.passwordHash).not.toBe("mi-clave-personal");
    expect(await bcrypt.compare("mi-clave-personal", data.passwordHash)).toBe(true);
  });

  it("rechaza si la contraseña actual no es la correcta", async () => {
    await expect(cambiarPassword("u-1", "otra-cosa", "mi-clave-personal")).rejects.toThrow(UnauthorizedError);
    expect(update).not.toHaveBeenCalled();
  });

  it("no acepta volver a poner la misma contraseña temporal", async () => {
    await expect(cambiarPassword("u-1", "temporal-123", "temporal-123")).rejects.toThrow(ConflictError);
    expect(update).not.toHaveBeenCalled();
  });
});
