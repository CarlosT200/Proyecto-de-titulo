import { Request, Response } from "express";
import { loginSchema, actualizarPerfilSchema, cambiarPasswordSchema } from "./auth.schema";
import { login, getPerfil, actualizarPerfil, actualizarFoto, cambiarPassword } from "./auth.service";
import { AppError } from "../../lib/errors";
import { fotoComoDataUri } from "../../lib/imagenes";

const FOTO_PERFIL_LADO = 320;

export async function loginController(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const resultado = await login(email, password);
  res.json(resultado);
}

export async function meController(req: Request, res: Response) {
  const usuario = await getPerfil(req.auth!.sub);
  res.json(usuario);
}

export async function actualizarPerfilController(req: Request, res: Response) {
  const data = actualizarPerfilSchema.parse(req.body);
  const usuario = await actualizarPerfil(req.auth!.sub, data);
  res.json(usuario);
}

export async function actualizarFotoController(req: Request, res: Response) {
  if (!req.file) throw new AppError("Selecciona una imagen.", 422);
  const fotoUrl = await fotoComoDataUri(req.file.buffer, { lado: FOTO_PERFIL_LADO, ajuste: "cover" });
  const usuario = await actualizarFoto(req.auth!.sub, fotoUrl);
  res.json(usuario);
}

export async function cambiarPasswordController(req: Request, res: Response) {
  const { actual, nueva } = cambiarPasswordSchema.parse(req.body);
  res.json(await cambiarPassword(req.auth!.sub, actual, nueva));
}
