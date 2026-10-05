import { Router } from "express";
import { Rol } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as controller from "./sos.controller";

const router = Router();

router.use(requireAuth);

// Evita que una cuenta sature a admin/conserje con alertas repetidas (por
// bug o mal uso) sin bloquear el caso real: alguien presiona el tipo
// equivocado y corrige al tiro. Por usuario autenticado (req.auth.sub), no
// por IP -- varios residentes del mismo condominio pueden salir por la
// misma IP publica y no deberian compartir el limite entre ellos.
const sosLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth!.sub,
  message: { error: "Demasiadas alertas enviadas. Espera unos minutos antes de volver a intentar." },
});

router.post("/", requireRole(Rol.RESIDENTE), sosLimiter, asyncHandler(controller.crearAlertaController));
router.get("/", requireRole(Rol.ADMIN, Rol.CONSERJE), asyncHandler(controller.listarAlertasController));
router.patch("/:id/atender", requireRole(Rol.ADMIN, Rol.CONSERJE), asyncHandler(controller.atenderAlertaController));

export default router;
