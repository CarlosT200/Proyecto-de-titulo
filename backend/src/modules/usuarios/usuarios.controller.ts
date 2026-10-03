import { Request, Response } from "express";
import {
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  listarUsuariosQuerySchema,
} from "./usuarios.schema";
import { crearUsuario, listarUsuarios, obtenerUsuario, actualizarUsuario } from "./usuarios.service";
import { auditar } from "../auditoria/auditoria.service";
import { ConflictError } from "../../lib/errors";

const ROL_LABEL = { ADMIN: "administrador", CONSERJE: "conserje", RESIDENTE: "residente" } as const;

export async function crearUsuarioController(req: Request, res: Response) {
  const data = crearUsuarioSchema.parse(req.body);
  const usuario = await crearUsuario(req.auth!.condominioId, data);
  await auditar(req, "CREAR", "Usuario", `Creó la cuenta de ${usuario.nombre} ${usuario.apellido} (${ROL_LABEL[usuario.rol]}).`, usuario.id);
  res.status(201).json(usuario);
}

export async function listarUsuariosController(req: Request, res: Response) {
  const filtros = listarUsuariosQuerySchema.parse(req.query);
  const usuarios = await listarUsuarios(req.auth!.condominioId, filtros);
  res.json(usuarios);
}

export async function obtenerUsuarioController(req: Request, res: Response) {
  const usuario = await obtenerUsuario(req.auth!.condominioId, req.params.id);
  res.json(usuario);
}

export async function actualizarUsuarioController(req: Request, res: Response) {
  const data = actualizarUsuarioSchema.parse(req.body);
  // Si la unica persona administradora se deshabilita a si misma, nadie mas puede entrar a administrar.
  if (data.activo === false && req.params.id === req.auth!.sub) {
    throw new ConflictError("No puedes deshabilitar tu propia cuenta.");
  }
  const usuario = await actualizarUsuario(req.auth!.condominioId, req.params.id, data);
  const nombre = `${usuario.nombre} ${usuario.apellido}`;
  const descripcion =
    data.activo === false
      ? `Deshabilitó la cuenta de ${nombre}.`
      : data.activo === true
        ? `Habilitó la cuenta de ${nombre}.`
        : `Actualizó los datos de ${nombre}.`;
  await auditar(req, "ACTUALIZAR", "Usuario", descripcion, usuario.id);
  res.json(usuario);
}
