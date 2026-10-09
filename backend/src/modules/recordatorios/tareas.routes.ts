import { timingSafeEqual } from "crypto";
import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { NotFoundError, UnauthorizedError } from "../../lib/errors";
import { env } from "../../config/env";
import { correrRecordatorios } from "./recordatorios.programador";

// Tareas programadas llamadas desde fuera (GitHub Actions), protegidas con una clave compartida
// (TAREAS_TOKEN). Sin esa variable configurada, la ruta no existe.
const router = Router();

function claveValida(recibida: string | undefined): boolean {
  if (!env.tareasToken || !recibida) return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(env.tareasToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

router.post(
  "/recordatorios",
  asyncHandler(async (req, res) => {
    if (!env.tareasToken) throw new NotFoundError("Ruta no encontrada.");
    if (!claveValida(req.header("x-tarea-token"))) throw new UnauthorizedError("Clave de tarea inválida.");
    const resumen = await correrRecordatorios("tarea externa");
    res.json(resumen ?? { enCurso: true });
  })
);

export default router;
