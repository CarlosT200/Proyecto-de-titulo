import { Router } from "express";
import { Rol } from "@prisma/client";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import {
  crearUsuarioController,
  listarUsuariosController,
  obtenerUsuarioController,
  actualizarUsuarioController,
  restablecerPasswordController,
} from "./usuarios.controller";

const router = Router();

router.use(requireAuth);

// El conserje necesita listar residentes en modo lectura para registrar encomiendas (HU-12).
router.get("/", requireRole(Rol.ADMIN, Rol.CONSERJE), asyncHandler(listarUsuariosController));
router.get("/:id", requireRole(Rol.ADMIN, Rol.CONSERJE), asyncHandler(obtenerUsuarioController));

router.post("/", requireRole(Rol.ADMIN), asyncHandler(crearUsuarioController));
router.patch("/:id", requireRole(Rol.ADMIN), asyncHandler(actualizarUsuarioController));
router.post("/:id/restablecer-password", requireRole(Rol.ADMIN), asyncHandler(restablecerPasswordController));

export default router;
