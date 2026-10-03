import { Router } from "express";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import { uploadArchivoMemoria } from "../../middleware/upload";
import * as controller from "./documentos.controller";

const router = Router();

// Antes de exigir sesion: se abre en una pestaña nueva con un enlace firmado de 2 minutos.
router.get("/archivo/:token", asyncHandler(controller.descargarArchivoController));

router.use(requireAuth);

router.post(
  "/",
  requireRole(Rol.ADMIN),
  uploadArchivoMemoria.single("archivo"),
  asyncHandler(controller.crearDocumentoController)
);
router.get("/", asyncHandler(controller.listarDocumentosController));
router.post("/:id/enlace", asyncHandler(controller.crearEnlaceController));
router.delete("/:id", requireRole(Rol.ADMIN), asyncHandler(controller.eliminarDocumentoController));

export default router;
