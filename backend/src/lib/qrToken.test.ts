import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ALFABETO_CODIGO,
  esCodigoManual,
  esTokenCorto,
  formatearCodigoManual,
  LARGO_CODIGO_MANUAL,
  normalizarCodigoManual,
  nuevoCodigoManual,
  nuevoTokenQr,
  signQrToken,
  verifyQrToken,
} from "./qrToken";
import { env } from "../config/env";

// Estas pruebas cubren el mecanismo de seguridad detras de todo el acceso
// por QR (HU-17 a HU-21, RNF-08/RNF-09): si esto falla, falla el control de
// acceso del condominio entero.
describe("codigo corto del QR", () => {
  it("mide 22 caracteres seguros para una URL y no se repite", () => {
    const codigos = Array.from({ length: 500 }, () => nuevoTokenQr());
    expect(new Set(codigos).size).toBe(500);
    for (const c of codigos) {
      expect(c).toHaveLength(22);
      expect(c).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(esTokenCorto(c)).toBe(true);
    }
  });

  it("no confunde un JWT, un texto vacio ni uno de otro largo con un codigo corto", () => {
    expect(esTokenCorto(signQrToken("r-1", "RESIDENTE", new Date(Date.now() + 60_000)))).toBe(false);
    expect(esTokenCorto("")).toBe(false);
    expect(esTokenCorto("abc")).toBe(false);
    expect(esTokenCorto("a".repeat(23))).toBe(false);
    expect(esTokenCorto("a".repeat(21) + "!")).toBe(false);
  });
});

// Formato anterior (JWT): los QR ya emitidos siguen validandose.
describe("codigo manual del QR (validacion sin camara)", () => {
  it("tiene 6 caracteres del alfabeto sin ambiguos (sin O, 0, I, 1, L)", () => {
    expect(LARGO_CODIGO_MANUAL).toBe(6);
    expect(ALFABETO_CODIGO).toHaveLength(31);
    expect(ALFABETO_CODIGO).not.toMatch(/[O0I1L]/);
    for (let i = 0; i < 2000; i++) {
      const codigo = nuevoCodigoManual();
      expect(codigo).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
      expect(esCodigoManual(codigo)).toBe(true);
    }
  });

  it("se muestra como XXX-XXX y lo que teclea el conserje vuelve al mismo codigo", () => {
    const codigo = nuevoCodigoManual();
    const formateado = formatearCodigoManual(codigo);
    expect(formateado).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    expect(normalizarCodigoManual(formateado.toLowerCase())).toBe(codigo);
  });

  it("todos los simbolos aparecen y ninguno se repite de forma anormal (sin sesgo evidente)", () => {
    const cuenta = new Map<string, number>();
    const N = 31 * 600; // ~600 apariciones esperadas por simbolo
    for (let i = 0; i < N / LARGO_CODIGO_MANUAL; i++) {
      for (const c of nuevoCodigoManual()) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
    }
    expect(cuenta.size).toBe(31);
    // Tolerancia amplia (6 desviaciones estandar) para que la prueba no falle por azar.
    for (const n of cuenta.values()) expect(Math.abs(n - 600)).toBeLessThan(6 * Math.sqrt(600));
  });

  it("usa crypto.randomInt y no Math.random ni el modulo de un byte", () => {
    const fuente = readFileSync(path.join(__dirname, "qrToken.ts"), "utf-8");
    const funcion = fuente.slice(fuente.indexOf("export function nuevoCodigoManual"), fuente.indexOf("// Limpia lo que teclea"));
    expect(funcion).toContain("randomInt(ALFABETO_CODIGO.length)");
    expect(funcion).not.toMatch(/Math\.random|%\s*ALFABETO_CODIGO\.length/);
  });

  it("el token QR opaco sigue siendo de 128 bits (22 caracteres base64url)", () => {
    expect(nuevoTokenQr()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(nuevoTokenQr(), "base64url")).toHaveLength(16);
  });
});

describe("qrToken", () => {
  it("firma y verifica un token válido, preservando jti y tipo", () => {
    const token = signQrToken("registro-1", "RESIDENTE", new Date(Date.now() + 60_000));
    const payload = verifyQrToken(token);
    expect(payload).toMatchObject({ jti: "registro-1", tipo: "RESIDENTE" });
  });

  it("nunca incluye datos personales en el payload, solo el id interno (RNF-09)", () => {
    const token = signQrToken("registro-2", "VISITA", new Date(Date.now() + 60_000));
    const payloadCrudo = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf-8"));
    expect(Object.keys(payloadCrudo).sort()).toEqual(["exp", "iat", "jti", "tipo"]);
  });

  it("rechaza un token vencido", () => {
    const vencido = jwt.sign({ jti: "x", tipo: "RESIDENTE" }, env.qrTokenSecret, { expiresIn: -10 });
    expect(() => verifyQrToken(vencido)).toThrow();
  });

  it("rechaza un token firmado con una clave distinta (manipulado)", () => {
    const firmadoConOtraClave = jwt.sign({ jti: "x", tipo: "RESIDENTE" }, "clave-incorrecta", { expiresIn: 60 });
    expect(() => verifyQrToken(firmadoConOtraClave)).toThrow();
  });

  it("rechaza texto que no es un JWT", () => {
    expect(() => verifyQrToken("esto-no-es-un-token")).toThrow();
  });
});
