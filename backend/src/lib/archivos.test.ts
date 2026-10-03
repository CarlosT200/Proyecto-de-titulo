import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import {
  coincideConTipo,
  firmarEnlaceDocumento,
  nombreDeArchivo,
  parsearDataUri,
  verificarEnlaceDocumento,
} from "./archivos";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const HTML = Buffer.from("<html><script>alert(1)</script></html>");

describe("coincideConTipo", () => {
  it("acepta archivos cuyo contenido corresponde al tipo declarado", () => {
    expect(coincideConTipo(PDF, "application/pdf")).toBe(true);
    expect(coincideConTipo(PNG, "image/png")).toBe(true);
    expect(coincideConTipo(JPG, "image/jpeg")).toBe(true);
    expect(coincideConTipo(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]), "image/webp")).toBe(true);
  });

  it("rechaza un HTML que se hace pasar por PDF o por imagen", () => {
    expect(coincideConTipo(HTML, "application/pdf")).toBe(false);
    expect(coincideConTipo(HTML, "image/png")).toBe(false);
  });

  it("rechaza un tipo que no esta permitido y un archivo vacio", () => {
    expect(coincideConTipo(PDF, "text/html")).toBe(false);
    expect(coincideConTipo(Buffer.alloc(0), "application/pdf")).toBe(false);
  });
});

describe("parsearDataUri", () => {
  it("separa el tipo y el contenido", () => {
    const uri = `data:application/pdf;base64,${PDF.toString("base64")}`;
    const resultado = parsearDataUri(uri);
    expect(resultado?.mime).toBe("application/pdf");
    expect(resultado?.buffer.equals(PDF)).toBe(true);
  });

  it("devuelve null si no es un data URI en base64", () => {
    expect(parsearDataUri("/uploads/viejo.pdf")).toBeNull();
    expect(parsearDataUri("data:text/plain,hola")).toBeNull();
  });
});

describe("nombreDeArchivo", () => {
  it("quita tildes y simbolos del titulo y agrega la extension", () => {
    expect(nombreDeArchivo("Reglamento de copropiedad (2026) / v2", "application/pdf")).toBe("Reglamento de copropiedad 2026  v2.pdf");
    expect(nombreDeArchivo("Acta ñandú", "image/jpeg")).toBe("Acta nandu.jpg");
    expect(nombreDeArchivo("???", "application/pdf")).toBe("documento.pdf");
  });
});

describe("enlaces de descarga", () => {
  it("un enlace recien firmado devuelve el documento y el condominio", () => {
    const token = firmarEnlaceDocumento("doc-1", "condo-1");
    expect(verificarEnlaceDocumento(token)).toEqual({ documentoId: "doc-1", condominioId: "condo-1" });
  });

  it("rechaza un enlace vencido o firmado con otra clave", () => {
    const vencido = jwt.sign({ doc: "d", cnd: "c" }, `${env.jwtSecret}:enlace-documento`, { expiresIn: -5 });
    const ajeno = jwt.sign({ doc: "d", cnd: "c" }, "otra-clave", { expiresIn: 60 });
    expect(() => verificarEnlaceDocumento(vencido)).toThrow();
    expect(() => verificarEnlaceDocumento(ajeno)).toThrow();
  });

  it("un token de sesion no sirve como enlace de documento (ni al reves)", () => {
    const sesion = jwt.sign({ sub: "u", rol: "ADMIN", condominioId: "c" }, env.jwtSecret, { expiresIn: 60 });
    expect(() => verificarEnlaceDocumento(sesion)).toThrow();
    const enlace = firmarEnlaceDocumento("d", "c");
    expect(() => jwt.verify(enlace, env.jwtSecret)).toThrow();
  });
});
