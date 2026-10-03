import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Rol } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { UnauthorizedError, ForbiddenError } from "../lib/errors";

export interface AuthPayload {
  sub: string; // usuarioId
  rol: Rol;
  condominioId: string;
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
// Ademas de verificar la firma del token, se consulta la cuenta en la base de datos: el token
// dura horas y antes una cuenta deshabilitada (o con el rol cambiado) seguia entrando con el
// token viejo hasta que vencia. El rol y el condominio que se usan son los de la base, no los
// que trae el token.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Debes iniciar sesión para acceder a este recurso.");
    }

    let payload: AuthPayload;
    try {
      payload = jwt.verify(header.slice("Bearer ".length), env.jwtSecret) as AuthPayload;
    } catch {
      throw new UnauthorizedError("Sesión inválida o expirada.");
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { activo: true, rol: true, condominioId: true },
    });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedError("Tu cuenta no está disponible. Contacta a la administración.");
    }

    req.auth = { sub: payload.sub, rol: usuario.rol, condominioId: usuario.condominioId };
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
