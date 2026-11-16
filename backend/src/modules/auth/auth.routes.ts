import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { uploadImagenMemoria } from "../../middleware/upload";
import {
  loginController,
  logoutController,
  logoutTodasController,
  listarSesionesController,
  cerrarSesionController,
  meController,
  actualizarPerfilController,
  actualizarFotoController,
  cambiarPasswordController,
} from "./auth.controller";
import { normalizarEmail } from "./auth.service";

const router = Router();

const QUINCE_MINUTOS = 15 * 60 * 1000;
const MENSAJE_LIMITE = { error: "Demasiados intentos. Intenta nuevamente en unos minutos." };

// Limita la fuerza bruta sobre el login (RNF-02 / OWASP) en dos niveles, contando SOLO los intentos
// fallidos (el dia que todo el condominio entra por primera vez desde la misma red WiFi, los
// ingresos correctos no agotan nada):
//
// 1. Por IP + correo: 10 fallos en 15 minutos. Frena adivinar la contraseña de una cuenta concreta
//    sin que una persona equivocada bloquee a sus vecinos, que salen por la misma IP publica.
// 2. Por IP (tope alto): 100 fallos en 15 minutos. Frena probar muchas cuentas distintas desde una
//    misma direccion. Es alto a proposito para no bloquear una red compartida por error.
const correoDelPedido = (body: unknown): string => {
  const email = (body as { email?: unknown } | null)?.email;
  return typeof email === "string" ? normalizarEmail(email) : "";
};

export const loginLimiterPorCorreo = rateLimit({
  windowMs: QUINCE_MINUTOS,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${correoDelPedido(req.body)}`,
  message: MENSAJE_LIMITE,
});

export const loginLimiterPorIp = rateLimit({
  windowMs: QUINCE_MINUTOS,
  limit: 100,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: MENSAJE_LIMITE,
});

// Misma proteccion para el cambio de contrasena (requiere adivinar la actual).
const passwordLimiter = rateLimit({
  windowMs: QUINCE_MINUTOS,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: MENSAJE_LIMITE,
});

router.post("/login", loginLimiterPorIp, loginLimiterPorCorreo, asyncHandler(loginController));
router.post("/logout", requireAuth, asyncHandler(logoutController));
router.post("/logout-todas", requireAuth, asyncHandler(logoutTodasController));
router.get("/sesiones", requireAuth, asyncHandler(listarSesionesController));
router.delete("/sesiones/:id", requireAuth, asyncHandler(cerrarSesionController));
router.get("/me", requireAuth, asyncHandler(meController));
router.patch("/me", requireAuth, asyncHandler(actualizarPerfilController));
router.patch("/me/foto", requireAuth, uploadImagenMemoria.single("foto"), asyncHandler(actualizarFotoController));
router.patch("/me/password", requireAuth, passwordLimiter, asyncHandler(cambiarPasswordController));

export default router;
