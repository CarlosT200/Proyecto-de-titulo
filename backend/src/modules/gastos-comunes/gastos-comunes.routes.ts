import { Router } from "express";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import { uploadArchivoMemoria } from "../../middleware/upload";
import * as controller from "./gastos-comunes.controller";
import * as comprobantes from "./comprobantes.controller";

const router = Router();

// Antes de exigir sesion: el archivo de un comprobante se abre con un enlace firmado de 2 minutos.
router.get("/comprobantes/archivo/:token", asyncHandler(comprobantes.archivoComprobanteController));

router.use(requireAuth);

// Residente: el estado de cuenta de su unidad
router.get("/mi-cuenta", requireRole(Rol.RESIDENTE), asyncHandler(controller.miCuentaController));
router.get("/cobros/:id", requireRole(Rol.ADMIN, Rol.RESIDENTE), asyncHandler(controller.obtenerCobroController));
router.post(
  "/cobros/:id/comprobantes",
  requireRole(Rol.RESIDENTE),
  uploadArchivoMemoria.single("archivo"),
  asyncHandler(comprobantes.informarPagoController)
);
router.post("/comprobantes/:id/enlace", requireRole(Rol.ADMIN, Rol.RESIDENTE), asyncHandler(comprobantes.enlaceComprobanteController));

// Administracion (la conserjeria no ve datos de cobranza)
router.get("/periodos", requireRole(Rol.ADMIN), asyncHandler(controller.listarPeriodosController));
router.post("/periodos", requireRole(Rol.ADMIN), asyncHandler(controller.crearPeriodoController));
router.get("/periodos/:id", requireRole(Rol.ADMIN), asyncHandler(controller.obtenerPeriodoController));
router.delete("/periodos/:id", requireRole(Rol.ADMIN), asyncHandler(controller.eliminarPeriodoController));
router.get("/morosidad", requireRole(Rol.ADMIN), asyncHandler(controller.morosidadController));
router.post("/cobros/:id/pagos", requireRole(Rol.ADMIN), asyncHandler(controller.registrarPagoController));
router.patch("/pagos/:id/anular", requireRole(Rol.ADMIN), asyncHandler(controller.anularPagoController));
router.get("/comprobantes", requireRole(Rol.ADMIN), asyncHandler(comprobantes.listarComprobantesController));
router.patch("/comprobantes/:id/aprobar", requireRole(Rol.ADMIN), asyncHandler(comprobantes.aprobarComprobanteController));
router.patch("/comprobantes/:id/rechazar", requireRole(Rol.ADMIN), asyncHandler(comprobantes.rechazarComprobanteController));
router.get("/alicuotas", requireRole(Rol.ADMIN), asyncHandler(controller.listarAlicuotasController));
router.put("/alicuotas", requireRole(Rol.ADMIN), asyncHandler(controller.guardarAlicuotasController));

export default router;
