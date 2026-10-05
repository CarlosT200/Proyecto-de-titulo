import { Request, Response } from "express";
import {
  crearEncomiendaSchema,
  devolverEncomiendaSchema,
  entregarEncomiendaSchema,
  listarEncomiendasQuerySchema,
} from "./encomiendas.schema";
import * as service from "./encomiendas.service";
import { auditar } from "../auditoria/auditoria.service";
import { fotoComoDataUri } from "../../lib/imagenes";

const FOTO_ENCOMIENDA_LADO = 800;

function deRemitente(remitente: string | null | undefined): string {
  return remitente ? ` de ${remitente}` : "";
}

export async function crearEncomiendaController(req: Request, res: Response) {
  const data = crearEncomiendaSchema.parse(req.body ?? {});
  const fotoUrl = req.file ? await fotoComoDataUri(req.file.buffer, { lado: FOTO_ENCOMIENDA_LADO, ajuste: "inside" }) : undefined;
  const encomienda = await service.crearEncomienda(req.auth!.condominioId, req.auth!.sub, { ...data, fotoUrl });
  await auditar(
    req,
    "CREAR",
    "Encomienda",
    `Registró una encomienda${deRemitente(data.remitente)} para ${encomienda.usuario.nombre} ${encomienda.usuario.apellido}.`,
    encomienda.id
  );
  res.status(201).json(encomienda);
}

export async function misEncomiendasController(req: Request, res: Response) {
  res.json(await service.listarMisEncomiendas(req.auth!.sub));
}

export async function listarEncomiendasController(req: Request, res: Response) {
  const filtros = listarEncomiendasQuerySchema.parse(req.query);
  res.json(await service.listarEncomiendasCondominio(req.auth!.condominioId, filtros));
}

export async function obtenerEncomiendaController(req: Request, res: Response) {
  res.json(await service.obtenerEncomienda(req.auth!.condominioId, req.params.id, { id: req.auth!.sub, rol: req.auth!.rol }));
}

export async function entregarEncomiendaController(req: Request, res: Response) {
  const { retiradaPor } = entregarEncomiendaSchema.parse(req.body ?? {});
  const encomienda = await service.entregarEncomienda(req.auth!.condominioId, req.params.id, req.auth!.sub, retiradaPor);
  await auditar(
    req,
    "ACTUALIZAR",
    "Encomienda",
    `Entregó la encomienda${deRemitente(encomienda.remitente)} de ${encomienda.usuario.nombre} ${encomienda.usuario.apellido} (la retiró ${encomienda.retiradaPor}).`,
    encomienda.id
  );
  res.json(encomienda);
}

export async function devolverEncomiendaController(req: Request, res: Response) {
  const { motivo } = devolverEncomiendaSchema.parse(req.body ?? {});
  const encomienda = await service.devolverEncomienda(req.auth!.condominioId, req.params.id, req.auth!.sub, motivo);
  await auditar(
    req,
    "ACTUALIZAR",
    "Encomienda",
    `Devolvió al remitente la encomienda${deRemitente(encomienda.remitente)} de ${encomienda.usuario.nombre} ${encomienda.usuario.apellido}.`,
    encomienda.id
  );
  res.json(encomienda);
}
