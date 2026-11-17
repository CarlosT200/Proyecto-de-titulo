import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ForbiddenError } from "../lib/errors";
import { COOKIE_CSRF, COOKIE_SESION } from "../lib/sesiones";
import { origenesConfigurados, protegerCsrf, validarTokenCsrf, verificarCsrfDeSesion } from "./csrf";

// En las pruebas env.corsOrigins = ["http://localhost:5173"] y env.appUrl = http://localhost:4000
// (ver vitest.config.ts y config/env.ts).
function pedido(opciones: {
  metodo?: string;
  origin?: string;
  referer?: string;
  host?: string;
  cookies?: Record<string, string>;
  csrf?: string;
}): Request {
  const headers: Record<string, string | undefined> = {
    origin: opciones.origin,
    referer: opciones.referer,
    host: opciones.host ?? "habitasmart.onrender.com",
    "x-csrf-token": opciones.csrf,
  };
  return {
    method: opciones.metodo ?? "POST",
    protocol: "https",
    cookies: opciones.cookies ?? {},
    get: (nombre: string) => headers[nombre.toLowerCase()],
  } as unknown as Request;
}

function ejecutar(req: Request) {
  const next = vi.fn();
  protegerCsrf(req, {} as Response, next);
  return next.mock.calls[0][0];
}

describe("protegerCsrf — origen", () => {
  it("los métodos de solo lectura pasan siempre", () => {
    for (const metodo of ["GET", "HEAD", "OPTIONS"]) {
      expect(ejecutar(pedido({ metodo, origin: "https://sitio-malicioso.example" }))).toBeUndefined();
    }
  });

  it("acepta el propio host, APP_URL y CORS_ORIGIN como origen", () => {
    expect(ejecutar(pedido({ origin: "https://habitasmart.onrender.com" }))).toBeUndefined();
    expect(ejecutar(pedido({ origin: "http://localhost:4000" }))).toBeUndefined();
    expect(ejecutar(pedido({ origin: "http://localhost:5173" }))).toBeUndefined();
    expect(origenesConfigurados()).toEqual(new Set(["http://localhost:5173", "http://localhost:4000"]));
  });

  it("rechaza un Origin ajeno en un método que modifica datos", () => {
    const error = ejecutar(pedido({ origin: "https://sitio-malicioso.example" }));
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toMatch(/Origen no permitido/);
  });

  it("sin Origin usa Referer, y rechaza un Referer ajeno o malformado", () => {
    expect(ejecutar(pedido({ referer: "https://habitasmart.onrender.com/residentes" }))).toBeUndefined();
    expect(ejecutar(pedido({ referer: "https://sitio-malicioso.example/x" }))).toBeInstanceOf(ForbiddenError);
    expect(ejecutar(pedido({ referer: "no-es-una-url" }))).toBeInstanceOf(ForbiddenError);
  });

  it("sin Origin ni Referer y sin cookie de sesión (login, tareas con clave propia) pasa", () => {
    expect(ejecutar(pedido({}))).toBeUndefined();
  });
});

describe("protegerCsrf — token de doble envío", () => {
  const conSesion = { [COOKIE_SESION]: "token", [COOKIE_CSRF]: "abc123" };

  it("con cookie de sesión exige la cabecera X-CSRF-Token igual a la cookie habitasmart_csrf", () => {
    expect(ejecutar(pedido({ cookies: conSesion, csrf: "abc123" }))).toBeUndefined();
  });

  it("rechaza si falta la cabecera, si no coincide, o si falta la cookie legible", () => {
    expect(ejecutar(pedido({ cookies: conSesion }))).toBeInstanceOf(ForbiddenError);
    expect(ejecutar(pedido({ cookies: conSesion, csrf: "otra" }))).toBeInstanceOf(ForbiddenError);
    expect(ejecutar(pedido({ cookies: { [COOKIE_SESION]: "token" }, csrf: "abc123" }))).toBeInstanceOf(ForbiddenError);
  });

  it("el mensaje de rechazo es entendible y no revela detalles internos", () => {
    const error = ejecutar(pedido({ cookies: conSesion, csrf: "otra" }));
    expect(error.message).toMatch(/Recarga la página/);
    expect(error.message).not.toMatch(/token|cookie/i);
  });
});

describe("verificarCsrfDeSesion (token ligado a la sesión en la base)", () => {
  it("en métodos que modifican datos la cabecera debe ser el token de la sesión", () => {
    expect(() => verificarCsrfDeSesion(pedido({ csrf: "de-la-sesion" }), "de-la-sesion")).not.toThrow();
    expect(() => verificarCsrfDeSesion(pedido({ csrf: "de-otra-sesion" }), "de-la-sesion")).toThrow(ForbiddenError);
    expect(() => verificarCsrfDeSesion(pedido({}), "de-la-sesion")).toThrow(ForbiddenError);
  });

  it("en GET no se exige", () => {
    expect(() => verificarCsrfDeSesion(pedido({ metodo: "GET" }), "de-la-sesion")).not.toThrow();
  });
});

describe("validarTokenCsrf y nombres de cookies", () => {
  it("los nombres literales que lee el middleware son los de las cookies que escribe la sesión", () => {
    expect(COOKIE_SESION).toBe("habitasmart_sesion");
    expect(COOKIE_CSRF).toBe("habitasmart_csrf");
  });

  it("solo acepta dos textos no vacíos e iguales", () => {
    expect(validarTokenCsrf("abc", "abc")).toBe(true);
    expect(validarTokenCsrf("abc", "abd")).toBe(false);
    expect(validarTokenCsrf("", "")).toBe(false);
    expect(validarTokenCsrf(undefined, "abc")).toBe(false);
    expect(validarTokenCsrf("abc", undefined)).toBe(false);
    expect(validarTokenCsrf(["abc"], "abc")).toBe(false);
  });
});
