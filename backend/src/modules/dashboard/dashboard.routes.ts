import { Router } from "express";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import { indicadoresController, panelConserjeriaController } from "./dashboard.controller";

const router = Router();

router.get("/", requireAuth, requireRole(Rol.ADMIN), asyncHandler(indicadoresController));
router.get("/conserjeria", requireAuth, requireRole(Rol.CONSERJE, Rol.ADMIN), asyncHandler(panelConserjeriaController));

export default router;
