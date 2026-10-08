import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { esTokenCorto, nuevoTokenQr, signQrToken, verifyQrToken } from "./qrToken";
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
