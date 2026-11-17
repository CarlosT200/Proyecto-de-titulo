import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

// Errores de Prisma que tienen una causa entendible para quien usa la app
// (no son bugs): sin esto caian todos al 500 generico "error inesperado".
const PRISMA_ERRORES: Record<string, { status: number; mensaje: string }> = {
  P2002: { status: 409, mensaje: "Ya existe un registro con esos datos." },
  P2003: { status: 409, mensaje: "No se puede completar la acción porque hay registros asociados." },
  P2025: { status: 404, mensaje: "El registro no existe o ya fue eliminado." },
};

// La base de datos no responde (caida, reinicio, sin conexiones libres): no es un error del codigo
// sino un problema temporal, y la persona debe saber que puede reintentar.
function esBaseNoDisponible(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientInitializationError ||
    (err instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1008", "P1017", "P2024"].includes(err.code))
  );
}

// RNF-13: mensajes comprensibles ante errores y operaciones exitosas. Nunca se devuelve la pila ni
// el mensaje interno: solo un texto para la persona y el codigo de referencia (requestId).
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: "Datos inválidos.",
      detalles: err.issues.map((issue) => ({ campo: issue.path.map(String).join("."), mensaje: issue.message })),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "El archivo es demasiado grande. El máximo es 8 MB." });
    }
    return res.status(400).json({ error: "No se pudo procesar el archivo enviado." });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && PRISMA_ERRORES[err.code]) {
    const { status, mensaje } = PRISMA_ERRORES[err.code];
    return res.status(status).json({ error: mensaje });
  }

  // Errores de express.json(): cuerpo mal formado o mas grande que el limite.
  const errorDeBody = err as { type?: string; status?: number };
  if (errorDeBody?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "La solicitud no tiene un formato válido." });
  }
  if (errorDeBody?.type === "entity.too.large") {
    return res.status(413).json({ error: "La solicitud es demasiado grande." });
  }

  const referencia = req?.requestId;
  if (esBaseNoDisponible(err)) {
    logger.error("base de datos no disponible", { requestId: referencia, error: err });
    return res.status(503).json({
      error: "El servicio no está disponible en este momento. Intenta nuevamente en unos segundos.",
      referencia,
    });
  }

  logger.error("error no controlado", { requestId: referencia, ruta: req?.originalUrl?.split("?")[0], error: err });
  return res.status(500).json({ error: "Ocurrió un error inesperado. Intenta nuevamente.", referencia });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Ruta no encontrada." });
}
