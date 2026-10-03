import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors";

// Errores de Prisma que tienen una causa entendible para quien usa la app
// (no son bugs): sin esto caian todos al 500 generico "error inesperado".
const PRISMA_ERRORES: Record<string, { status: number; mensaje: string }> = {
  P2002: { status: 409, mensaje: "Ya existe un registro con esos datos." },
  P2003: { status: 409, mensaje: "No se puede completar la acción porque hay registros asociados." },
  P2025: { status: 404, mensaje: "El registro no existe o ya fue eliminado." },
};

// RNF-13: mensajes comprensibles ante errores y operaciones exitosas.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: "Datos inválidos.",
      detalles: err.issues.map((issue) => ({ campo: issue.path.join("."), mensaje: issue.message })),
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

  console.error(err);
  return res.status(500).json({ error: "Ocurrió un error inesperado. Intenta nuevamente." });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Ruta no encontrada." });
}
