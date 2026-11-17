import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { logger, redactarTexto } from "../lib/logger";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Identificador de la solicitud: viaja en la cabecera X-Request-Id de la respuesta y en cada
      // linea de log, para poder seguir un error de punta a punta.
      requestId?: string;
    }
  }
}

// Se acepta el X-Request-Id que mande un proxy (Render/Cloudflare) solo si tiene una forma segura;
// si no, se genera uno nuevo. Nunca se escribe en el log un valor arbitrario del cliente.
const FORMA_VALIDA = /^[A-Za-z0-9._-]{8,64}$/;

export function asignarRequestId(req: Request, res: Response, next: NextFunction) {
  const recibido = req.get("x-request-id");
  req.requestId = recibido && FORMA_VALIDA.test(recibido) ? recibido : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}

// Ruta sin query string (puede llevar filtros con datos) y con los tokens ocultos.
export function rutaParaLog(req: Request): string {
  return redactarTexto(req.originalUrl.split("?")[0]).slice(0, 200);
}

// Una linea por solicitud al terminar: metodo, ruta, estado, duracion e identificadores. Sin
// cuerpos, cabeceras ni IP completa (la IP es dato personal; basta con el requestId para rastrear).
export function registrarSolicitud(req: Request, res: Response, next: NextFunction) {
  const inicio = process.hrtime.bigint();
  res.on("finish", () => {
    // Los recursos estaticos del frontend no aportan nada al log.
    if (!req.originalUrl.startsWith("/api") && res.statusCode < 400) return;
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    const datos = {
      requestId: req.requestId,
      metodo: req.method,
      ruta: rutaParaLog(req),
      estado: res.statusCode,
      ms: Math.round(ms),
      usuarioId: req.auth?.sub,
    };
    if (res.statusCode >= 500) logger.error("solicitud", datos);
    else if (res.statusCode >= 400) logger.info("solicitud", datos);
    else logger.info("solicitud", datos);
  });
  next();
}
