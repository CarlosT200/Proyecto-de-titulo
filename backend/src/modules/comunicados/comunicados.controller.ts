import { Request, Response } from "express";
import { crearComunicadoSchema } from "./comunicados.schema";
import * as service from "./comunicados.service";
import { auditar } from "../auditoria/auditoria.service";

export async function crearComunicadoController(req: Request, res: Response) {
  const data = crearComunicadoSchema.parse(req.body);
  const comunicado = await service.crearComunicado(req.auth!.condominioId, req.auth!.sub, data);
  await auditar(req, "CREAR", "Comunicado", `Publicó el comunicado "${comunicado.titulo}".`, comunicado.id);
  res.status(201).json(comunicado);
}

export async function listarComunicadosController(req: Request, res: Response) {
  res.json(await service.listarComunicados(req.auth!.condominioId));
}

export async function eliminarComunicadoController(req: Request, res: Response) {
  const eliminado = await service.eliminarComunicado(req.auth!.condominioId, req.params.id);
  await auditar(req, "ELIMINAR", "Comunicado", `Eliminó el comunicado "${eliminado.titulo}".`, req.params.id);
  res.status(204).send();
}
