import { Router, Request } from "express";
import rateLimit from "express-rate-limit";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as controller from "./qr.controller";

const router = Router();

router.use(requireAuth);

// El código manual del QR (para la validación a mano en portería) tiene 6 caracteres. Sin un límite,
// una sesión de conserje comprometida podría probar miles de códigos por minuto hasta acertar uno
// vigente (fuerza bruta). Se cuenta por conserje —no por IP— porque varios dispositivos de portería
// comparten la misma red; así el límite no castiga a un conserje por lo que haga otro. Un conserje
// humano valida de a uno (cámara o tecleo), muy por debajo de este tope.
export function clavePorConserje(req: Request): string {
  return req.auth?.sub ?? req.ip ?? "desconocido";
}

const validarLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clavePorConserje,
  message: { error: "Demasiadas validaciones seguidas. Espera unos segundos e inténtalo de nuevo." },
});

// HU-17
router.post("/residente", requireRole(Rol.RESIDENTE), asyncHandler(controller.generarQrResidenteController));

// HU-19 / HU-20
router.post("/visitas", requireRole(Rol.RESIDENTE), asyncHandler(controller.crearVisitaController));
router.get("/visitas/mias", requireRole(Rol.RESIDENTE), asyncHandler(controller.misVisitasController));
router.post(
  "/visitas/:id/qr",
  requireRole(Rol.RESIDENTE),
  asyncHandler(controller.generarQrVisitaController)
);
router.get("/visitas/:id/qr", requireRole(Rol.RESIDENTE), asyncHandler(controller.verQrVisitaController));
router.post(
  "/visitas/rapida",
  requireRole(Rol.RESIDENTE),
  asyncHandler(controller.crearVisitaRapidaController)
);
router.patch(
  "/visitas/:id/revocar",
  requireRole(Rol.RESIDENTE),
  asyncHandler(controller.revocarVisitaController)
);

// HU-18 / HU-21
router.post("/validar", requireRole(Rol.CONSERJE), validarLimiter, asyncHandler(controller.validarQrController));
router.get("/accesos", requireRole(Rol.ADMIN, Rol.CONSERJE), asyncHandler(controller.listarAccesosController));

export default router;
