import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Rol } from "@prisma/client";
import { env } from "../config/env";
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
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Debes iniciar sesión para acceder a este recurso.");
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    throw new UnauthorizedError("Sesión inválida o expirada.");
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
