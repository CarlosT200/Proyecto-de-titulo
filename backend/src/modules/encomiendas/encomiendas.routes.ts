import { Router } from "express";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import { uploadImagenMemoria } from "../../middleware/upload";
import * as controller from "./encomiendas.controller";

const router = Router();

router.use(requireAuth);

// La foto es opcional (multipart); sin foto tambien acepta JSON.
router.post(
  "/",
  requireRole(Rol.CONSERJE),
  uploadImagenMemoria.single("foto"),
  asyncHandler(controller.crearEncomiendaController)
);
router.get("/mias", requireRole(Rol.RESIDENTE), asyncHandler(controller.misEncomiendasController));
router.get("/", requireRole(Rol.ADMIN, Rol.CONSERJE), asyncHandler(controller.listarEncomiendasController));
router.get("/:id", asyncHandler(controller.obtenerEncomiendaController));
// "retirar" se mantiene como ruta por compatibilidad: es la entrega al residente.
router.patch("/:id/retirar", requireRole(Rol.CONSERJE), asyncHandler(controller.entregarEncomiendaController));
router.patch("/:id/devolver", requireRole(Rol.CONSERJE), asyncHandler(controller.devolverEncomiendaController));

export default router;
