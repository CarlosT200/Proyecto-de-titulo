import { Router } from "express";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as controller from "./reservas.controller";

const router = Router();

router.use(requireAuth);

router.get("/disponibilidad", asyncHandler(controller.disponibilidadController));
router.get("/ocupacion", asyncHandler(controller.ocupacionController));
router.post("/", requireRole(Rol.RESIDENTE), asyncHandler(controller.crearReservaController));
router.get("/mias", requireRole(Rol.RESIDENTE), asyncHandler(controller.misReservasController));
router.get("/", requireRole(Rol.ADMIN), asyncHandler(controller.listarReservasController));
router.patch("/:id/cancelar", asyncHandler(controller.cancelarReservaController));

export default router;
