import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ForbiddenError } from "../lib/errors";
import { CABECERA_CSRF, igualesEnTiempoConstante } from "../lib/sesiones";

// --- Proteccion CSRF (Fase 2B) ------------------------------------------------------------------
// Con la sesion en una cookie, el navegador la adjunta solo a cualquier pedido hacia la API, incluso
// si lo inicia un sitio ajeno. Dos capas, ambas obligatorias en los metodos que modifican datos:
//
// 1. Origen: si el pedido trae "Origin" (o, en su defecto, "Referer"), debe ser uno de los origenes
//    permitidos (el propio host, APP_URL y CORS_ORIGIN). Los navegadores siempre mandan Origin en
//    los POST/PUT/PATCH/DELETE iniciados desde una pagina, y un sitio ajeno no puede falsearlo.
// 2. Token ligado a la sesion: la cabecera X-CSRF-Token debe coincidir con la cookie legible
//    habitasmart_csrf (aqui) y con el token guardado en la sesion (en requireAuth). Un sitio ajeno
//    no puede leer esa cookie, asi que no puede construir la cabecera.
//
// Los pedidos sin cookie de sesion (login, tareas con clave propia) pasan solo por la capa 1.

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

export const MENSAJE_CSRF = "La solicitud fue rechazada por seguridad. Recarga la página e inténtalo de nuevo.";

function origenDe(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function origenesConfigurados(): Set<string> {
  const origenes = new Set<string>();
  for (const valor of [...env.corsOrigins, env.appUrl]) {
    const origen = origenDe(valor);
    if (origen) origenes.add(origen);
  }
  return origenes;
}

export function origenesPermitidos(req: Request): Set<string> {
  const origenes = origenesConfigurados();
  // El propio host del pedido (en Render, detras del proxy, req.protocol respeta X-Forwarded-Proto).
  const host = req.get("host");
  if (host) origenes.add(`${req.protocol}://${host}`);
  return origenes;
}

export function esMetodoSeguro(metodo: string): boolean {
  return METODOS_SEGUROS.has(metodo.toUpperCase());
}

export function protegerCsrf(req: Request, _res: Response, next: NextFunction) {
  if (esMetodoSeguro(req.method)) return next();

  const permitidos = origenesPermitidos(req);
  const origin = req.get("origin");
  if (origin) {
    if (!permitidos.has(origin)) return next(new ForbiddenError("Origen no permitido."));
  } else {
    const referer = req.get("referer");
    if (referer) {
      const origenReferer = origenDe(referer);
      if (!origenReferer || !permitidos.has(origenReferer)) return next(new ForbiddenError("Origen no permitido."));
    }
  }

  // Las cookies se leen por su nombre literal (habitasmart_sesion / habitasmart_csrf, iguales a
  // COOKIE_SESION y COOKIE_CSRF; lo comprueba csrf.test.ts) para que el analisis estatico de CodeQL
  // reconozca este middleware como proteccion CSRF.
  const cookieSesion: unknown = req.cookies?.habitasmart_sesion;
  if (cookieSesion) {
    const cabecera = req.get(CABECERA_CSRF);
    const cookieCsrf: unknown = req.cookies?.habitasmart_csrf;
    if (!validarTokenCsrf(cabecera, cookieCsrf)) {
      return next(new ForbiddenError(MENSAJE_CSRF));
    }
  }

  next();
}

// Compara en tiempo constante el token de la cabecera con el esperado. Falso si falta alguno.
export function validarTokenCsrf(cabecera: unknown, esperado: unknown): boolean {
  return typeof cabecera === "string" && typeof esperado === "string" && cabecera.length > 0 && igualesEnTiempoConstante(cabecera, esperado);
}

// Segunda mitad de la capa 2, con la sesion ya cargada: la cabecera debe ser el token de ESTA
// sesion (no basta con que coincida con la cookie).
export function verificarCsrfDeSesion(req: Request, csrfTokenDeSesion: string): void {
  if (esMetodoSeguro(req.method)) return;
  if (!validarTokenCsrf(req.get(CABECERA_CSRF), csrfTokenDeSesion)) {
    throw new ForbiddenError(MENSAJE_CSRF);
  }
}
