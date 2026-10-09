import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    torre: { findFirst: vi.fn() },
    departamento: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "../../lib/prisma";
import { crearDepartamento } from "./condominio.service";
import { ConflictError, NotFoundError } from "../../lib/errors";

const torreFindFirst = prisma.torre.findFirst as unknown as Mock;
const deptoFindFirst = prisma.departamento.findFirst as unknown as Mock;
const create = prisma.departamento.create as unknown as Mock;

beforeEach(() => vi.clearAllMocks());

describe("crearDepartamento", () => {
  it("rechaza una torre de otro condominio", async () => {
    torreFindFirst.mockResolvedValue(null);
    await expect(crearDepartamento("condo-1", { numero: "101", torreId: "torre-ajena" })).rejects.toBeInstanceOf(NotFoundError);
    expect(create).not.toHaveBeenCalled();
  });

  it("no repite una unidad que ya existe en la misma torre", async () => {
    torreFindFirst.mockResolvedValue({ id: "torre-1" });
    deptoFindFirst.mockResolvedValue({ id: "d-1" });
    await expect(crearDepartamento("condo-1", { numero: " 101 ", torreId: "torre-1" })).rejects.toBeInstanceOf(ConflictError);
    expect(create).not.toHaveBeenCalled();
  });

  it("crea la unidad con el numero sin espacios", async () => {
    torreFindFirst.mockResolvedValue({ id: "torre-1" });
    deptoFindFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: "d-2" });
    await crearDepartamento("condo-1", { numero: " 102 ", torreId: "torre-1" });
    expect(create.mock.calls[0][0].data).toEqual({ condominioId: "condo-1", numero: "102", torreId: "torre-1" });
  });
});
