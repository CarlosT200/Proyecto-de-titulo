import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, redactar, redactarTexto } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("redacción de datos sensibles", () => {
  it("oculta contraseñas, tokens, cabeceras de sesión, QR y archivos por nombre de clave", () => {
    const limpio = redactar({
      email: "persona@prueba.test",
      password: "secreta",
      nueva: "otra",
      headers: { authorization: "Bearer abc", cookie: "habitasmart_sesion=xyz", "x-csrf-token": "c" },
      token: "qr-token",
      codigoManual: "ABC123",
      archivo: "data:application/pdf;base64,AAAA",
      sesion: { tokenHash: "h", csrfToken: "c" },
    }) as Record<string, unknown>;
    const texto = JSON.stringify(limpio);
    for (const secreto of ["secreta", "otra", "Bearer abc", "xyz", "qr-token", "ABC123", "AAAA", '"h"']) {
      expect(texto).not.toContain(secreto);
    }
    expect(limpio.email).toBe("persona@prueba.test");
  });

  it("oculta patrones dentro de textos libres", () => {
    expect(redactarTexto("postgresql://usuario:MiClave@host:5432/db")).toBe("postgresql://usuario:[oculto]@host:5432/db");
    expect(redactarTexto("Authorization: Bearer eyJabc.def")).not.toContain("eyJabc");
    expect(redactarTexto("Cookie: habitasmart_sesion=abc123; otra=1")).toContain("habitasmart_sesion=[oculto]");
    expect(redactarTexto("/acceso/AbCdEfGhIjKlMnOpQrStUv")).toBe("/acceso/[oculto]");
    expect(redactarTexto(`foto data:image/png;base64,${"A".repeat(40)}`)).toBe("foto data:[archivo oculto]");
  });

  it("un Error se registra con nombre y mensaje redactado (sin pila en producción)", () => {
    vi.stubEnv("NODE_ENV", "production");
    const r = redactar(new Error("falló postgres://u:clave@h/db")) as Record<string, unknown>;
    expect(r.mensaje).toBe("falló postgres://u:[oculto]@h/db");
    expect(r).not.toHaveProperty("pila");
  });
});

describe("logger", () => {
  it("en producción escribe una línea JSON por evento, ya redactada", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "info");
    const salida = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logger.info("login", { requestId: "r-1", password: "x" });
    const linea = JSON.parse(String(salida.mock.calls[0][0]));
    expect(linea).toMatchObject({ nivel: "info", msg: "login", requestId: "r-1", password: "[oculto]" });
    expect(linea.t).toEqual(expect.any(String));
  });

  it("respeta el nivel mínimo configurado", () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    const salida = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logger.info("no debería salir");
    expect(salida).not.toHaveBeenCalled();
  });
});
