import { Request, Response } from "express";
import { loginSchema, actualizarPerfilSchema, cambiarPasswordSchema } from "./auth.schema";
import { login, getPerfil, actualizarPerfil, actualizarFoto, cambiarPassword } from "./auth.service";
import { AppError, NotFoundError } from "../../lib/errors";
import { fotoComoDataUri } from "../../lib/imagenes";
import {
  borrarCookiesDeSesion,
  crearSesion,
  escribirCookiesDeSesion,
  listarSesionesVigentes,
  revocarSesion,
  revocarSesionesDeUsuario,
} from "../../lib/sesiones";

const FOTO_PERFIL_LADO = 320;

export async function loginController(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const { usuario, sesion } = await login(email, password, req.get("user-agent"));
  escribirCookiesDeSesion(res, sesion);
  // El token de sesion viaja SOLO en la cookie HttpOnly; nunca en el cuerpo de la respuesta.
  res.json({ usuario });
}

export async function logoutController(req: Request, res: Response) {
  await revocarSesion(req.auth!.sub, req.auth!.sesionId);
  borrarCookiesDeSesion(res);
  res.status(204).send();
}

// Cierra todas las sesiones de la persona, incluida la actual (por ejemplo, si cree que alguien
// mas tiene acceso a su cuenta).
export async function logoutTodasController(req: Request, res: Response) {
  const cerradas = await revocarSesionesDeUsuario(req.auth!.sub);
  borrarCookiesDeSesion(res);
  res.json({ cerradas });
}

export async function listarSesionesController(req: Request, res: Response) {
  const sesiones = await listarSesionesVigentes(req.auth!.sub);
  res.json(sesiones.map((s) => ({ ...s, actual: s.id === req.auth!.sesionId })));
}

export async function cerrarSesionController(req: Request, res: Response) {
  if (req.params.id === req.auth!.sesionId) {
    throw new AppError("Para cerrar esta sesión usa «Salir».", 409);
  }
  const cerrada = await revocarSesion(req.auth!.sub, req.params.id);
  if (!cerrada) throw new NotFoundError("La sesión no existe o ya estaba cerrada.");
  res.status(204).send();
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
  const usuario = await cambiarPassword(req.auth!.sub, actual, nueva);
  // Todas las sesiones anteriores quedaron revocadas: se abre una nueva para quien hizo el cambio.
  const sesion = await crearSesion({ id: usuario.id, rol: usuario.rol }, req.get("user-agent"));
  escribirCookiesDeSesion(res, sesion);
  res.json({ usuario });
}
