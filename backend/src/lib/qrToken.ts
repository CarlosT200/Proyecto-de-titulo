import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

// Codigo del QR: 16 bytes aleatorios en base64url = 22 caracteres. Es opaco: no contiene datos
// personales ni el id del registro (RNF-09), solo es la llave para buscar el QrToken en la base,
// donde estan la vigencia (RNF-08), si fue revocado y cuantos usos lleva. No necesita firma porque
// la validacion siempre consulta la base; con 128 bits aleatorios no se puede adivinar.
//
// Por que no un JWT: firmado medía ~180 caracteres y el link completo ~250, o sea un QR de 85x85
// modulos que la camara de un celular casi no lograba leer. Con 22 caracteres el QR es de 33-41
// modulos y se lee a mas distancia, con menos luz y con la pantalla un poco borrosa.
const LARGO_TOKEN_CORTO = 22;
const FORMATO_TOKEN_CORTO = /^[A-Za-z0-9_-]{22}$/;

export function nuevoTokenQr(): string {
  return randomBytes(16).toString("base64url");
}

export function esTokenCorto(token: string): boolean {
  return token.length === LARGO_TOKEN_CORTO && FORMATO_TOKEN_CORTO.test(token);
}

// Codigo corto y legible para la validacion manual (cuando la camara no puede leer el QR). Se
// muestra bajo el QR del residente y de la visita. Alfabeto sin caracteres ambiguos (sin O, 0, I,
// 1, L) para que no se confundan al leerlo o teclearlo. 6 caracteres = 30^6 (~729 millones) de
// combinaciones; la unicidad la garantiza el indice unico de la base al generarlo.
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function nuevoCodigoManual(): string {
  const bytes = randomBytes(6);
  let codigo = "";
  for (let i = 0; i < 6; i++) codigo += ALFABETO_CODIGO[bytes[i] % ALFABETO_CODIGO.length];
  return codigo;
}

// Limpia lo que teclea el conserje: mayusculas y solo letras/numeros (se sacan guiones y espacios).
export function normalizarCodigoManual(entrada: string): string {
  return entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function esCodigoManual(valor: string): boolean {
  return valor.length === 6 && [...valor].every((c) => ALFABETO_CODIGO.includes(c));
}

// Formato para mostrar: dos grupos de tres (ABJ-K7P) para que sea mas facil de leer y dictar.
export function formatearCodigoManual(codigo: string): string {
  return codigo.length === 6 ? `${codigo.slice(0, 3)}-${codigo.slice(3)}` : codigo;
}

// --- Formato anterior (JWT) ---
// Los QR emitidos antes del cambio (24 h para residentes, hasta el fin del periodo para visitas)
// siguen siendo validos: validarQr acepta ambos formatos. signQrToken ya no se usa para generar
// codigos nuevos; queda para las pruebas de compatibilidad.
//
// RFC 7519 (JWT): el claim "exp" limita la vigencia del codigo QR (RNF-08).
// El payload solo contiene el identificador interno (jti) del registro QrToken,
// nunca datos personales del residente o de la visita (RNF-09).
interface QrJwtPayload {
  jti: string;
  tipo: "RESIDENTE" | "VISITA";
}

export function signQrToken(jti: string, tipo: "RESIDENTE" | "VISITA", expiraEn: Date): string {
  const segundosRestantes = Math.max(1, Math.floor((expiraEn.getTime() - Date.now()) / 1000));
  return jwt.sign({ jti, tipo } satisfies QrJwtPayload, env.qrTokenSecret, {
    expiresIn: segundosRestantes,
  });
}

export function verifyQrToken(token: string): QrJwtPayload {
  return jwt.verify(token, env.qrTokenSecret) as QrJwtPayload;
}
