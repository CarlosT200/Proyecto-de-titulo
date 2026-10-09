import { describe, expect, it } from "vitest";
import { actualizarEspacioComunSchema, crearEspacioComunSchema } from "./condominio.schema";

describe("horario de un espacio comun", () => {
  it("rechaza un horario que termina antes o a la misma hora que empieza", () => {
    expect(crearEspacioComunSchema.safeParse({ nombre: "Quincho", horarioInicio: "22:00", horarioFin: "10:00" }).success).toBe(false);
    expect(crearEspacioComunSchema.safeParse({ nombre: "Quincho", horarioInicio: "10:00", horarioFin: "10:00" }).success).toBe(false);
    expect(actualizarEspacioComunSchema.safeParse({ horarioInicio: "23:00", horarioFin: "09:00" }).success).toBe(false);
  });

  it("acepta un horario valido y los cambios que no tocan el horario", () => {
    expect(crearEspacioComunSchema.safeParse({ nombre: "Quincho", horarioInicio: "10:00", horarioFin: "23:00" }).success).toBe(true);
    expect(actualizarEspacioComunSchema.safeParse({ activo: false }).success).toBe(true);
    expect(actualizarEspacioComunSchema.safeParse({ capacidad: 30 }).success).toBe(true);
  });
});
