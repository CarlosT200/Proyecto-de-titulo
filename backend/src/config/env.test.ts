import { describe, expect, it } from "vitest";
import { secretoFuerte } from "./env";

// Un secreto de sesión (JWT) o de QR corto o de ejemplo en producción permitiría falsificar
// sesiones o códigos de acceso. La validación corre al arrancar el backend (ver env.ts).
describe("secretoFuerte", () => {
  it("en producción exige al menos 32 caracteres", () => {
    expect(secretoFuerte("corto", true)).toBe(false);
    expect(secretoFuerte("x".repeat(31), true)).toBe(false);
    expect(secretoFuerte("x".repeat(32), true)).toBe(true);
    expect(secretoFuerte("x".repeat(64), true)).toBe(true);
  });

  it("fuera de producción acepta cualquier valor para no estorbar dev/pruebas", () => {
    expect(secretoFuerte("corto", false)).toBe(true);
    expect(secretoFuerte("", false)).toBe(true);
  });
});
