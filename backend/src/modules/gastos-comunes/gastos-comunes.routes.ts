import { Router } from "express";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as controller from "./gastos-comunes.controller";

const router = Router();

router.use(requireAuth);

// Residente: el estado de cuenta de su unidad
router.get("/mi-cuenta", requireRole(Rol.RESIDENTE), asyncHandler(controller.miCuentaController));
router.get("/cobros/:id", requireRole(Rol.ADMIN, Rol.RESIDENTE), asyncHandler(controller.obtenerCobroController));

// Administracion (la conserjeria no ve datos de cobranza)
router.get("/periodos", requireRole(Rol.ADMIN), asyncHandler(controller.listarPeriodosController));
router.post("/periodos", requireRole(Rol.ADMIN), asyncHandler(controller.crearPeriodoController));
router.get("/periodos/:id", requireRole(Rol.ADMIN), asyncHandler(controller.obtenerPeriodoController));
router.delete("/periodos/:id", requireRole(Rol.ADMIN), asyncHandler(controller.eliminarPeriodoController));
router.get("/morosidad", requireRole(Rol.ADMIN), asyncHandler(controller.morosidadController));
router.post("/cobros/:id/pagos", requireRole(Rol.ADMIN), asyncHandler(controller.registrarPagoController));
router.patch("/pagos/:id/anular", requireRole(Rol.ADMIN), asyncHandler(controller.anularPagoController));
router.get("/alicuotas", requireRole(Rol.ADMIN), asyncHandler(controller.listarAlicuotasController));
router.put("/alicuotas", requireRole(Rol.ADMIN), asyncHandler(controller.guardarAlicuotasController));

export default router;
