import { Request, Response } from "express";
import { crearEncomiendaSchema, listarEncomiendasQuerySchema } from "./encomiendas.schema";
import * as service from "./encomiendas.service";
import { auditar } from "../auditoria/auditoria.service";

export async function crearEncomiendaController(req: Request, res: Response) {
  const data = crearEncomiendaSchema.parse(req.body);
  const encomienda = await service.crearEncomienda(req.auth!.condominioId, req.auth!.sub, data);
  const remitente = data.remitente ? ` de ${data.remitente}` : "";
  await auditar(req, "CREAR", "Encomienda", `Registró una encomienda${remitente}.`, encomienda.id);
  res.status(201).json(encomienda);
}

export async function misEncomiendasController(req: Request, res: Response) {
  res.json(await service.listarMisEncomiendas(req.auth!.sub));
}

export async function listarEncomiendasController(req: Request, res: Response) {
  const filtros = listarEncomiendasQuerySchema.parse(req.query);
  res.json(await service.listarEncomiendasCondominio(req.auth!.condominioId, filtros));
}

export async function marcarRetiradaController(req: Request, res: Response) {
  const encomienda = await service.marcarRetirada(req.auth!.condominioId, req.params.id);
  await auditar(req, "ACTUALIZAR", "Encomienda", "Marcó una encomienda como retirada.", encomienda.id);
  res.json(encomienda);
}
