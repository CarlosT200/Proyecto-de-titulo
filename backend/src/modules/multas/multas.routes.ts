import { Router } from "express";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as controller from "./multas.controller";

const router = Router();

router.use(requireAuth);

router.post("/", requireRole(Rol.ADMIN), asyncHandler(controller.crearMultaController));
router.get("/mias", requireRole(Rol.RESIDENTE), asyncHandler(controller.misMultasController));
router.patch("/:id/apelar", requireRole(Rol.RESIDENTE), asyncHandler(controller.apelarMultaController));
router.get("/", requireRole(Rol.ADMIN), asyncHandler(controller.listarMultasController));
router.patch("/:id", requireRole(Rol.ADMIN), asyncHandler(controller.actualizarMultaController));
router.delete("/:id", requireRole(Rol.ADMIN), asyncHandler(controller.eliminarMultaController));

export default router;
