import { Router } from "express";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as controller from "./qr.controller";

const router = Router();

router.use(requireAuth);

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
router.post("/validar", requireRole(Rol.CONSERJE), asyncHandler(controller.validarQrController));
router.get("/accesos", requireRole(Rol.ADMIN, Rol.CONSERJE), asyncHandler(controller.listarAccesosController));

export default router;
