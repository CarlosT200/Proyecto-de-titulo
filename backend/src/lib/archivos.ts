import jwt from "jsonwebtoken";
import { env } from "../config/env";

// --- Verificacion del contenido real de un archivo subido ---------------------------------------
// multer solo conoce el tipo que declara el navegador, que cualquiera puede falsear. Se comprueban
// los primeros bytes (la "firma" de cada formato) para que un archivo no se haga pasar por otro.
const FIRMAS: Record<string, (b: Buffer) => boolean> = {
  "application/pdf": (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  "image/png": (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
};

export function coincideConTipo(buffer: Buffer, mime: string): boolean {
  const verificar = FIRMAS[mime];
  return verificar ? verificar(buffer) : false;
}

const EXTENSIONES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function extensionDeMime(mime: string): string | null {
  return EXTENSIONES[mime] ?? null;
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

// --- Enlaces de descarga de corta vida ----------------------------------------------------------
// Un enlace normal no puede llevar el encabezado de autorizacion, y abrir un "data:" en una pestaña
// nueva lo bloquea Chrome. Por eso la aplicacion pide (con su sesion) un enlace que vale 2 minutos,
// se abre en otra pestaña y se descarta. Se firma con una clave distinta a la de las sesiones, asi
// un enlace de documento nunca sirve como token de sesion.
const VIGENCIA_ENLACE_SEGUNDOS = 120;
const claveEnlaces = () => `${env.jwtSecret}:enlace-documento`;

export function firmarEnlaceDocumento(documentoId: string, condominioId: string): string {
  return jwt.sign({ doc: documentoId, cnd: condominioId }, claveEnlaces(), { expiresIn: VIGENCIA_ENLACE_SEGUNDOS });
}

export function verificarEnlaceDocumento(token: string): { documentoId: string; condominioId: string } {
  const payload = jwt.verify(token, claveEnlaces()) as { doc?: unknown; cnd?: unknown };
  if (typeof payload.doc !== "string" || typeof payload.cnd !== "string") {
    throw new Error("Enlace inválido.");
  }
  return { documentoId: payload.doc, condominioId: payload.cnd };
}
