import { Router } from "express";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import { uploadArchivoMemoria } from "../../middleware/upload";
import * as controller from "./documentos.controller";

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  requireRole(Rol.ADMIN),
  uploadArchivoMemoria.single("archivo"),
  asyncHandler(controller.crearDocumentoController)
);
router.get("/", asyncHandler(controller.listarDocumentosController));
// El archivo se abre en una pestaña nueva con la sesion (cookie): no hay enlaces con token en la URL.
router.get("/:id/archivo", asyncHandler(controller.descargarArchivoController));
router.delete("/:id", requireRole(Rol.ADMIN), asyncHandler(controller.eliminarDocumentoController));

export default router;
