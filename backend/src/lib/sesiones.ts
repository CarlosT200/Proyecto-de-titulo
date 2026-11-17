import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { CookieOptions, Response } from "express";
import { Rol } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "./prisma";

// --- Sesiones del lado del servidor (Fase 2B) ---------------------------------------------------
// El navegador guarda un token aleatorio en una cookie HttpOnly (JavaScript no puede leerla, asi
// que un XSS no puede robarla). En la base queda solo el hash del token. Cada pedido busca la
// sesion por hash y comprueba que no este revocada ni vencida y que la cuenta siga activa.

export const COOKIE_SESION = "habitasmart_sesion";
// Cookie LEGIBLE por JavaScript con el token anti-CSRF (patron "doble envio" ligado a la sesion):
// el cliente la repite en la cabecera X-CSRF-Token. Un sitio ajeno no puede leerla.
export const COOKIE_CSRF = "habitasmart_csrf";
export const CABECERA_CSRF = "x-csrf-token";

const LARGO_AGENTE = 200;

export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function igualesEnTiempoConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Personal (administracion y conserjeria): sesion corta, suelen usar equipos compartidos.
// Residentes: sesion larga para no pedirles la contraseña todos los dias. Es seguro porque cada
// pedido revisa la sesion y la cuenta en la base, y cualquier sesion se puede revocar.
export function duracionSesionMs(rol: Rol): number {
  return rol === Rol.RESIDENTE ? env.sesionResidenteDias * 24 * 3600 * 1000 : env.sesionPersonalHoras * 3600 * 1000;
}

// SameSite=Lax (no Strict) a proposito: el QR codifica un enlace https://.../acceso/<token> que el
// conserje abre desde la camara del celular. Esa es una navegacion de nivel superior desde fuera
// de la app; con Strict la cookie no viajaria y el conserje apareceria sin sesion justo cuando mas
// la necesita. Lax envia la cookie en esas navegaciones (GET) y la bloquea en los POST/PUT/PATCH/
// DELETE que inicia otro sitio, que es lo que importa contra CSRF (ademas del token).
function opcionesBase(expiraEn: Date): CookieOptions {
  return { secure: env.isProd, sameSite: "lax", path: "/", expires: expiraEn };
}

export function opcionesCookieSesion(expiraEn: Date): CookieOptions {
  return { ...opcionesBase(expiraEn), httpOnly: true };
}

export function opcionesCookieCsrf(expiraEn: Date): CookieOptions {
  return { ...opcionesBase(expiraEn), httpOnly: false };
}

export interface SesionEmitida {
  token: string;
  csrfToken: string;
  expiraEn: Date;
}

export function escribirCookiesDeSesion(res: Response, sesion: SesionEmitida): void {
  res.cookie(COOKIE_SESION, sesion.token, opcionesCookieSesion(sesion.expiraEn));
  res.cookie(COOKIE_CSRF, sesion.csrfToken, opcionesCookieCsrf(sesion.expiraEn));
}

export function borrarCookiesDeSesion(res: Response): void {
  // Mismos atributos que al crearlas: si difieren, el navegador no las borra.
  res.clearCookie(COOKIE_SESION, { httpOnly: true, secure: env.isProd, sameSite: "lax", path: "/" });
  res.clearCookie(COOKIE_CSRF, { httpOnly: false, secure: env.isProd, sameSite: "lax", path: "/" });
}

function recortarAgente(agente: string | undefined): string | null {
  if (!agente) return null;
  return agente.slice(0, LARGO_AGENTE);
}

export async function crearSesion(usuario: { id: string; rol: Rol }, agente?: string): Promise<SesionEmitida> {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(24).toString("base64url");
  const expiraEn = new Date(Date.now() + duracionSesionMs(usuario.rol));
  await prisma.sesion.create({
    data: { usuarioId: usuario.id, tokenHash: hashDeToken(token), csrfToken, expiraEn, agente: recortarAgente(agente) },
  });
  return { token, csrfToken, expiraEn };
}

export const SESION_SELECT = {
  id: true,
  usuarioId: true,
  csrfToken: true,
  creadaEn: true,
  ultimoUsoEn: true,
  expiraEn: true,
  revocadaEn: true,
  usuario: { select: { activo: true, rol: true, condominioId: true, passwordCambiadaEn: true } },
} as const;

export function buscarSesionPorToken(token: string) {
  return prisma.sesion.findUnique({ where: { tokenHash: hashDeToken(token) }, select: SESION_SELECT });
}

// "ultimoUsoEn" se actualiza como mucho cada 5 minutos: sirve para que la persona reconozca sus
// sesiones, no hace falta un UPDATE en cada pedido.
const INTERVALO_ULTIMO_USO_MS = 5 * 60 * 1000;

export function registrarUsoDeSesion(sesion: { id: string; ultimoUsoEn: Date }): void {
  if (Date.now() - sesion.ultimoUsoEn.getTime() < INTERVALO_ULTIMO_USO_MS) return;
  prisma.sesion
    .updateMany({ where: { id: sesion.id, revocadaEn: null }, data: { ultimoUsoEn: new Date() } })
    .catch(() => {});
}

// Revoca una sesion concreta de un usuario. Devuelve false si no existia o ya estaba revocada.
export async function revocarSesion(usuarioId: string, sesionId: string): Promise<boolean> {
  const { count } = await prisma.sesion.updateMany({
    where: { id: sesionId, usuarioId, revocadaEn: null },
    data: { revocadaEn: new Date() },
  });
  return count > 0;
}

// Revoca todas las sesiones vigentes de un usuario (cambio o restablecimiento de contraseña,
// cuenta deshabilitada, "cerrar todas las sesiones"). Con "exceptoId" conserva una (la actual).
export async function revocarSesionesDeUsuario(usuarioId: string, opciones: { exceptoId?: string } = {}): Promise<number> {
  const { count } = await prisma.sesion.updateMany({
    where: { usuarioId, revocadaEn: null, ...(opciones.exceptoId ? { id: { not: opciones.exceptoId } } : {}) },
    data: { revocadaEn: new Date() },
  });
  return count;
}

// Sesiones vigentes de un usuario, para "Mi perfil". Nunca devuelve el hash ni el token CSRF.
export async function listarSesionesVigentes(usuarioId: string) {
  return prisma.sesion.findMany({
    where: { usuarioId, revocadaEn: null, expiraEn: { gt: new Date() } },
    select: { id: true, agente: true, creadaEn: true, ultimoUsoEn: true, expiraEn: true },
    orderBy: { ultimoUsoEn: "desc" },
  });
}

// Limpieza: las sesiones vencidas o revocadas hace mas de 30 dias ya no sirven ni como historial.
const RETENCION_SESIONES_CERRADAS_MS = 30 * 24 * 3600 * 1000;

export async function eliminarSesionesCaducadas(): Promise<number> {
  const limite = new Date(Date.now() - RETENCION_SESIONES_CERRADAS_MS);
  const { count } = await prisma.sesion.deleteMany({
    where: { OR: [{ expiraEn: { lt: limite } }, { revocadaEn: { lt: limite } }] },
  });
  return count;
}
