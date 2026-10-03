import jwt, { SignOptions } from "jsonwebtoken";
import { Rol } from "@prisma/client";
import { env } from "../config/env";
import { AuthPayload } from "../middleware/auth";

export function signAuthToken(payload: { sub: string; rol: Rol; condominioId: string }): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: payload.rol === Rol.RESIDENTE ? env.jwtExpiresInResidente : env.jwtExpiresIn,
  } as SignOptions);
}

export function verifyAuthToken(token: string): AuthPayload {
  return jwt.verify(token, env.jwtSecret) as AuthPayload;
}
