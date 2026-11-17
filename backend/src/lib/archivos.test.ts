import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import {
  coincideConTipo,
  contentDisposition,
  enviarArchivoVerificado,
  extensionDeMime,
  leerArchivoHeredado,
  nombreDeArchivo,
  parsearDataUri,
} from "./archivos";
import { AppError } from "./errors";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const HTML = Buffer.from("<html><script>alert(1)</script></html>");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe("coincideConTipo", () => {
  it("acepta archivos cuyo contenido corresponde al tipo declarado", () => {
    expect(coincideConTipo(PDF, "application/pdf")).toBe(true);
    expect(coincideConTipo(PNG, "image/png")).toBe(true);
    expect(coincideConTipo(JPG, "image/jpeg")).toBe(true);
    expect(coincideConTipo(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]), "image/webp")).toBe(true);
  });

  it("rechaza un HTML o un SVG que se hace pasar por PDF o por imagen", () => {
    expect(coincideConTipo(HTML, "application/pdf")).toBe(false);
    expect(coincideConTipo(HTML, "image/png")).toBe(false);
    expect(coincideConTipo(SVG, "image/svg+xml")).toBe(false);
    expect(coincideConTipo(SVG, "image/png")).toBe(false);
  });

  it("rechaza un tipo que no esta permitido y un archivo vacio", () => {
    expect(coincideConTipo(PDF, "text/html")).toBe(false);
    expect(coincideConTipo(Buffer.alloc(0), "application/pdf")).toBe(false);
  });

  // CodeQL js/unvalidated-dynamic-method-call: el MIME elige que funcion se ejecuta. Con un acceso
  // simple, "constructor" devolvia Object (y Object(buffer) es "verdadero"), asi que un archivo
  // cualquiera pasaba como valido. Solo deben contar las claves propias de la tabla de firmas.
  it("no ejecuta propiedades heredadas: constructor, __proto__, toString, hasOwnProperty", () => {
    for (const mime of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "__defineGetter__"]) {
      expect(coincideConTipo(HTML, mime)).toBe(false);
      expect(coincideConTipo(PDF, mime)).toBe(false);
    }
  });

  it("un MIME desconocido o vacio devuelve false (no lanza)", () => {
    for (const mime of ["application/x-desconocido", "", "IMAGE/PNG", "image/png ", "image/svg+xml"]) {
      expect(coincideConTipo(PNG, mime)).toBe(false);
    }
  });

  it("un tipo permitido con firma falsa se rechaza en los cuatro formatos", () => {
    const falso = Buffer.from("esto no es ninguno de los formatos permitidos");
    for (const mime of ["application/pdf", "image/png", "image/jpeg", "image/webp"]) {
      expect(coincideConTipo(falso, mime)).toBe(false);
    }
    // firma de otro formato permitido: un PNG declarado como JPEG o PDF tampoco pasa
    expect(coincideConTipo(PNG, "image/jpeg")).toBe(false);
    expect(coincideConTipo(JPG, "application/pdf")).toBe(false);
  });

  it("devuelve siempre un booleano", () => {
    expect(typeof coincideConTipo(PDF, "application/pdf")).toBe("boolean");
    expect(typeof coincideConTipo(PDF, "constructor")).toBe("boolean");
  });
});

describe("extensionDeMime", () => {
  it("devuelve la extension de los tipos permitidos y null para claves heredadas o desconocidas", () => {
    expect(extensionDeMime("application/pdf")).toBe("pdf");
    expect(extensionDeMime("image/jpeg")).toBe("jpg");
    expect(extensionDeMime("constructor")).toBeNull();
    expect(extensionDeMime("__proto__")).toBeNull();
    expect(extensionDeMime("text/html")).toBeNull();
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

describe("nombreDeArchivo y Content-Disposition", () => {
  it("quita tildes y simbolos del titulo y agrega la extension", () => {
    expect(nombreDeArchivo("Reglamento de copropiedad (2026) / v2", "application/pdf")).toBe("Reglamento de copropiedad 2026  v2.pdf");
    expect(nombreDeArchivo("Acta ñandú", "image/jpeg")).toBe("Acta nandu.jpg");
    expect(nombreDeArchivo("???", "application/pdf")).toBe("documento.pdf");
  });

  it("un titulo malicioso no puede cortar la cabecera ni salir de la carpeta", () => {
    const nombre = nombreDeArchivo('a"; filename="x.html\r\nSet-Cookie: x=1 ../../etc/passwd', "application/pdf");
    expect(nombre).not.toMatch(/["\r\n/]/);
    const cabecera = contentDisposition(nombre);
    expect(cabecera).toMatch(/^inline; filename="[^"\r\n]*"$/);
  });
});

describe("enviarArchivoVerificado", () => {
  function respuesta() {
    const cabeceras: Record<string, unknown> = { "Content-Security-Policy": "default-src 'self'" };
    const res = {
      setHeader: vi.fn((k: string, v: unknown) => (cabeceras[k] = v)),
      removeHeader: vi.fn((k: string) => delete cabeceras[k]),
      end: vi.fn(),
    };
    return { res: res as unknown as Response, cabeceras, end: res.end };
  }

  it("envia nosniff, sin cache, tipo real, largo y Content-Disposition seguro", () => {
    const { res, cabeceras, end } = respuesta();
    enviarArchivoVerificado(res, { mime: "image/png", buffer: PNG }, "foto.png");
    expect(cabeceras["X-Content-Type-Options"]).toBe("nosniff");
    expect(cabeceras["Cache-Control"]).toBe("private, no-store");
    expect(cabeceras["Content-Type"]).toBe("image/png");
    expect(cabeceras["Content-Length"]).toBe(PNG.length);
    expect(cabeceras["Content-Disposition"]).toBe('inline; filename="foto.png"');
    // a una imagen se le mantiene la politica de seguridad
    expect(cabeceras["Content-Security-Policy"]).toBeDefined();
    expect(end).toHaveBeenCalledWith(PNG);
  });

  it("solo a los PDF se les quita la CSP (el visor del navegador la necesita)", () => {
    const { res, cabeceras } = respuesta();
    enviarArchivoVerificado(res, { mime: "application/pdf", buffer: PDF }, "a.pdf");
    expect(cabeceras["Content-Security-Policy"]).toBeUndefined();
  });

  it("nunca sirve un contenido que no coincide con su tipo (por ejemplo HTML guardado como PDF)", () => {
    const { res, end } = respuesta();
    expect(() => enviarArchivoVerificado(res, { mime: "application/pdf", buffer: HTML }, "a.pdf")).toThrow(AppError);
    expect(end).not.toHaveBeenCalled();
  });
});

describe("leerArchivoHeredado (documentos antiguos en disco)", () => {
  const carpeta = mkdtempSync(path.join(tmpdir(), "habitasmart-uploads-"));
  writeFileSync(path.join(carpeta, "acta.pdf"), PDF);
  writeFileSync(path.join(carpeta, "falso.pdf"), HTML);
  writeFileSync(path.join(carpeta, "pagina.html"), HTML);

  afterAll(() => rmSync(carpeta, { recursive: true, force: true }));

  it("lee un PDF valido dentro de la carpeta", async () => {
    const archivo = await leerArchivoHeredado(carpeta, "/uploads/acta.pdf");
    expect(archivo?.mime).toBe("application/pdf");
    expect(archivo?.buffer.equals(PDF)).toBe(true);
  });

  it("rechaza path traversal, subcarpetas, extensiones no permitidas y contenido falso", async () => {
    expect(await leerArchivoHeredado(carpeta, "/uploads/../package.json")).toBeNull();
    expect(await leerArchivoHeredado(carpeta, "/uploads/..%2F..%2Fsecreto.pdf")).toBeNull();
    expect(await leerArchivoHeredado(carpeta, "/uploads/sub/acta.pdf")).toBeNull();
    expect(await leerArchivoHeredado(carpeta, "/uploads/pagina.html")).toBeNull();
    expect(await leerArchivoHeredado(carpeta, "/uploads/falso.pdf")).toBeNull();
    expect(await leerArchivoHeredado(carpeta, "/uploads/no-existe.pdf")).toBeNull();
    expect(await leerArchivoHeredado(carpeta, "data:application/pdf;base64,AAAA")).toBeNull();
  });
});
