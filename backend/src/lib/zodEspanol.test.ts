import { describe, expect, it } from "vitest";
import { z } from "zod";
import "./zodEspanol";

const mensaje = (esquema: z.ZodTypeAny, valor: unknown) => {
  const r = esquema.safeParse(valor);
  return r.success ? null : r.error.issues[0].message;
};

describe("mensajes de validación en español", () => {
  it("traduce los mensajes que el esquema no personaliza", () => {
    expect(mensaje(z.object({ a: z.string() }), {})).toBe("Falta un dato obligatorio.");
    expect(mensaje(z.string().uuid(), "x")).toBe("El identificador enviado no es válido.");
    expect(mensaje(z.string().max(3), "abcd")).toBe("Puede tener hasta 3 caracteres.");
    expect(mensaje(z.string().min(5), "ab")).toBe("Debe tener al menos 5 caracteres.");
    expect(mensaje(z.enum(["A", "B"]), "C")).toBe("Elige una de las opciones disponibles.");
    expect(mensaje(z.number(), "x")).toBe("Uno de los datos no tiene el formato esperado.");
  });

  it("respeta los mensajes escritos en cada esquema", () => {
    expect(mensaje(z.string().min(1, "El título es obligatorio."), "")).toBe("El título es obligatorio.");
  });
});
