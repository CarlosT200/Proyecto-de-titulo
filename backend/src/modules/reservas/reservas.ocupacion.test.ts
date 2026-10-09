import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../../lib/prisma", () => ({
  prisma: { espacioComun: { findFirst: vi.fn() }, reserva: { findMany: vi.fn() } },
}));

import { prisma } from "../../lib/prisma";
import { consultarOcupacion } from "./reservas.service";
import { ocupacionQuerySchema } from "./reservas.schema";
import { NotFoundError } from "../../lib/errors";

const findEspacio = prisma.espacioComun.findFirst as unknown as Mock;
const findReservas = prisma.reserva.findMany as unknown as Mock;
const ID = "2095cea0-83a4-489c-a93e-9ee6ba05dc04";

beforeEach(() => vi.clearAllMocks());

describe("consultarOcupacion (calendario)", () => {
  it("devuelve solo horarios confirmados del rango, sin datos de quien reservo", async () => {
    findEspacio.mockResolvedValue({ id: ID, nombre: "Quincho", horarioInicio: "10:00", horarioFin: "23:00", activo: true });
    findReservas.mockResolvedValue([{ fecha: new Date("2026-10-10T00:00:00.000Z"), horaInicio: "12:00", horaFin: "14:00" }]);
    const r = await consultarOcupacion("condo-1", ID, "2026-10-01", "2026-10-31");
    expect(r.reservas).toEqual([{ fecha: "2026-10-10", horaInicio: "12:00", horaFin: "14:00" }]);
    const consulta = findReservas.mock.calls[0][0];
    expect(consulta.where).toMatchObject({ espacioComunId: ID, estado: "CONFIRMADA" });
    expect(Object.keys(consulta.select)).toEqual(["fecha", "horaInicio", "horaFin"]);
  });

  it("no muestra espacios de otro condominio", async () => {
    findEspacio.mockResolvedValue(null);
    await expect(consultarOcupacion("condo-1", ID, "2026-10-01", "2026-10-31")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("limita el rango a dos meses y exige un orden valido", () => {
    expect(ocupacionQuerySchema.safeParse({ espacioComunId: ID, desde: "2026-10-01", hasta: "2026-11-30" }).success).toBe(true);
    expect(ocupacionQuerySchema.safeParse({ espacioComunId: ID, desde: "2026-10-01", hasta: "2027-01-15" }).success).toBe(false);
    expect(ocupacionQuerySchema.safeParse({ espacioComunId: ID, desde: "2026-10-10", hasta: "2026-10-01" }).success).toBe(false);
  });
});
