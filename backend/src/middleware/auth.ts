import { NextFunction, Request, Response } from "express";
import { Rol } from "@prisma/client";
import { UnauthorizedError, ForbiddenError } from "../lib/errors";
import { borrarCookiesDeSesion, buscarSesionPorToken, COOKIE_SESION, registrarUsoDeSesion } from "../lib/sesiones";
import { verificarCsrfDeSesion } from "./csrf";

export interface AuthPayload {
  sub: string; // usuarioId
  rol: Rol;
  condominioId: string;
  sesionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

// RNF-04: las funcionalidades deben restringirse segun el rol del usuario.
//
// La sesion viaja en una cookie HttpOnly (ver lib/sesiones.ts). Ademas de encontrarla por su hash,
// se comprueba en cada pedido que no este revocada ni vencida y que la cuenta siga activa: una
// cuenta deshabilitada, o una sesion cerrada desde otro dispositivo, queda fuera de inmediato. El
// rol y el condominio que se usan son los de la base, no los de ningun dato que traiga el cliente.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const token = cookies[COOKIE_SESION];
    if (!token || typeof token !== "string") {
      throw new UnauthorizedError("Debes iniciar sesión para acceder a este recurso.");
    }

    const sesion = await buscarSesionPorToken(token);
    if (!sesion) {
      borrarCookiesDeSesion(res);
      throw new UnauthorizedError("Sesión inválida o expirada.");
    }
    if (sesion.revocadaEn) {
      borrarCookiesDeSesion(res);
      throw new UnauthorizedError("Tu sesión fue cerrada. Inicia sesión de nuevo.");
    }
    if (sesion.expiraEn.getTime() <= Date.now()) {
      borrarCookiesDeSesion(res);
      throw new UnauthorizedError("Tu sesión expiró. Inicia sesión de nuevo.");
    }
    const { usuario } = sesion;
    if (!usuario.activo) {
      borrarCookiesDeSesion(res);
      throw new UnauthorizedError("Tu cuenta no está disponible. Contacta a la administración.");
    }
    // Defensa adicional a la revocacion explicita: si la contraseña se cambio o restablecio despues
    // de abrir esta sesion, la sesion ya no vale.
    if (usuario.passwordCambiadaEn && usuario.passwordCambiadaEn.getTime() > sesion.creadaEn.getTime()) {
      borrarCookiesDeSesion(res);
      throw new UnauthorizedError("Tu contraseña cambió. Inicia sesión de nuevo.");
    }

    // CSRF: en los metodos que modifican datos, la cabecera debe ser el token de ESTA sesion.
    verificarCsrfDeSesion(req, sesion.csrfToken);

    registrarUsoDeSesion(sesion);
    req.auth = { sub: sesion.usuarioId, rol: usuario.rol, condominioId: usuario.condominioId, sesionId: sesion.id };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }
    if (!roles.includes(req.auth.rol)) {
      throw new ForbiddenError("Tu rol no tiene acceso a esta funcionalidad.");
    }
    next();
  };
}
