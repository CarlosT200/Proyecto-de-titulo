import fs from "node:fs/promises";
import path from "node:path";
import type { Response } from "express";
import { AppError } from "./errors";

// --- Verificacion del contenido real de un archivo subido ---------------------------------------
// multer solo conoce el tipo que declara el navegador, que cualquiera puede falsear. Se comprueban
// los primeros bytes (la "firma" de cada formato) para que un archivo no se haga pasar por otro.
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function esPdf(b: Buffer): boolean {
  return b.subarray(0, 5).toString("latin1") === "%PDF-";
}

function esPng(b: Buffer): boolean {
  return b.length >= 8 && b.subarray(0, 8).equals(FIRMA_PNG);
}

function esJpeg(b: Buffer): boolean {
  return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

function esWebp(b: Buffer): boolean {
  return b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
}

// El MIME viene de fuera (navegador o data URI guardado), asi que NO decide que funcion se ejecuta:
// cada tipo permitido llama a su verificador con una llamada fija, y cualquier otro valor
// (incluidos "constructor", "__proto__" o "toString") cae en default y devuelve false.
export function coincideConTipo(buffer: Buffer, mime: string): boolean {
  switch (mime) {
    case "application/pdf":
      return esPdf(buffer);
    case "image/png":
      return esPng(buffer);
    case "image/jpeg":
      return esJpeg(buffer);
    case "image/webp":
      return esWebp(buffer);
    default:
      return false;
  }
}

// Para la tabla de extensiones (solo datos, no funciones) se usan unicamente claves PROPIAS: asi
// "constructor" o "__proto__" no devuelven valores heredados de Object.
// (Equivale a Object.hasOwn, que no esta en la lib ES2021 del tsconfig.)
function esClavePropia(objeto: object, clave: string): boolean {
  return Object.prototype.hasOwnProperty.call(objeto, clave);
}

const EXTENSIONES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function extensionDeMime(mime: string): string | null {
  return esClavePropia(EXTENSIONES, mime) ? EXTENSIONES[mime] : null;
}

// Los documentos se guardan como "data:<tipo>;base64,<contenido>" dentro de la base de datos.
export function parsearDataUri(uri: string): { mime: string; buffer: Buffer } | null {
  const coincidencia = /^data:([a-z]+\/[a-z0-9.+-]+);base64,/i.exec(uri);
  if (!coincidencia) return null;
  return { mime: coincidencia[1].toLowerCase(), buffer: Buffer.from(uri.slice(coincidencia[0].length), "base64") };
}

// Nombre para la descarga: el titulo del documento sin caracteres problematicos y con su extension.
export function nombreDeArchivo(titulo: string, mime: string): string {
  const base =
    titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._ -]+/g, "")
      .trim()
      .slice(0, 80) || "documento";
  const extension = extensionDeMime(mime);
  return extension ? `${base}.${extension}` : base;
}

// Content-Disposition seguro: el nombre ya viene limpio (solo ASCII y sin comillas), asi que no
// puede cortar la cabecera ni inyectar otra. Siempre "inline": PDF e imagenes se muestran en la
// pestaña; el navegador igual permite guardarlos.
export function contentDisposition(nombre: string): string {
  const seguro = nombre.replace(/["\\\r\n]/g, "").slice(0, 120) || "archivo";
  return `inline; filename="${seguro}"`;
}

// --- Entrega de un archivo verificado ------------------------------------------------------------
// Solo se sirven PDF e imagenes cuyo contenido coincide con su tipo, con "nosniff" para que el
// navegador no los reinterprete (por ejemplo como HTML) y sin cache compartida. Para los PDF se
// quita la politica general de seguridad: el visor de PDF del navegador no funciona con
// object-src 'none'; es seguro porque el contenido ya fue verificado por su firma.
export function enviarArchivoVerificado(res: Response, archivo: { mime: string; buffer: Buffer }, nombre: string): void {
  if (!coincideConTipo(archivo.buffer, archivo.mime)) {
    throw new AppError("El archivo está dañado o no se puede mostrar.", 422);
  }
  if (archivo.mime === "application/pdf") res.removeHeader("Content-Security-Policy");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Type", archivo.mime);
  res.setHeader("Content-Length", archivo.buffer.length);
  res.setHeader("Content-Disposition", contentDisposition(nombre));
  res.end(archivo.buffer);
}

// --- Archivos heredados en disco ----------------------------------------------------------------
// Antes de guardar los documentos en la base, se escribian en backend/uploads y se servian como
// carpeta publica. Esa carpeta ya no se expone: un documento antiguo ("/uploads/<nombre>") se lee
// aqui, con la sesion verificada, y solo si esta dentro de la carpeta y es un PDF o imagen valido.
export async function leerArchivoHeredado(uploadsDir: string, archivoUrl: string): Promise<{ mime: string; buffer: Buffer } | null> {
  if (!archivoUrl.startsWith("/uploads/")) return null;
  // Solo el nombre de archivo: cualquier "../" o subcarpeta queda fuera (path traversal).
  const nombre = path.basename(archivoUrl.slice("/uploads/".length));
  if (!nombre || nombre !== archivoUrl.slice("/uploads/".length)) return null;
  const ruta = path.join(uploadsDir, nombre);
  if (!ruta.startsWith(path.resolve(uploadsDir) + path.sep) && path.dirname(ruta) !== path.resolve(uploadsDir)) return null;
  const extension = path.extname(nombre).toLowerCase().slice(1);
  const mime = Object.entries(EXTENSIONES).find(([, ext]) => ext === extension)?.[0];
  if (!mime) return null;
  try {
    const buffer = await fs.readFile(ruta);
    return coincideConTipo(buffer, mime) ? { mime, buffer } : null;
  } catch {
    return null;
  }
}
