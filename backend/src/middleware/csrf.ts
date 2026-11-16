import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ForbiddenError } from "../lib/errors";
import { CABECERA_CSRF, COOKIE_CSRF, COOKIE_SESION, igualesEnTiempoConstante } from "../lib/sesiones";

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

  const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
  if (cookies[COOKIE_SESION]) {
    const cabecera = req.get(CABECERA_CSRF);
    const cookieCsrf = cookies[COOKIE_CSRF];
    if (!cabecera || !cookieCsrf || !igualesEnTiempoConstante(cabecera, cookieCsrf)) {
      return next(new ForbiddenError(MENSAJE_CSRF));
    }
  }

  next();
}

// Segunda mitad de la capa 2, con la sesion ya cargada: la cabecera debe ser el token de ESTA
// sesion (no basta con que coincida con la cookie).
export function verificarCsrfDeSesion(req: Request, csrfTokenDeSesion: string): void {
  if (esMetodoSeguro(req.method)) return;
  const cabecera = req.get(CABECERA_CSRF);
  if (!cabecera || !igualesEnTiempoConstante(cabecera, csrfTokenDeSesion)) {
    throw new ForbiddenError(MENSAJE_CSRF);
  }
}
