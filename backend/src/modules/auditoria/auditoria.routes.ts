import { Router } from "express";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as controller from "./auditoria.controller";

const router = Router();

router.use(requireAuth);
router.get("/", requireRole(Rol.ADMIN), asyncHandler(controller.listarAuditoriaController));

export default router;
