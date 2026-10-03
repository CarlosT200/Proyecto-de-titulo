import { Request, Response } from "express";
import { crearMultaSchema, actualizarMultaSchema, listarMultasQuerySchema } from "./multas.schema";
import * as service from "./multas.service";
import { auditar } from "../auditoria/auditoria.service";
import { ESTADO_MULTA_LABEL } from "../../lib/etiquetas";

export async function crearMultaController(req: Request, res: Response) {
  const data = crearMultaSchema.parse(req.body);
  const multa = await service.crearMulta(req.auth!.condominioId, req.auth!.sub, data);
  const monto = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
    data.monto
  );
  await auditar(req, "CREAR", "Multa", `Registró una multa por "${data.motivo}" de ${monto}.`, multa.id);
  res.status(201).json(multa);
}

export async function misMultasController(req: Request, res: Response) {
  res.json(await service.listarMisMultas(req.auth!.sub));
}

export async function listarMultasController(req: Request, res: Response) {
  const filtros = listarMultasQuerySchema.parse(req.query);
  res.json(await service.listarMultasCondominio(req.auth!.condominioId, filtros));
}

export async function actualizarMultaController(req: Request, res: Response) {
  const data = actualizarMultaSchema.parse(req.body);
  const multa = await service.actualizarMulta(req.auth!.condominioId, req.params.id, data);
  const cambio = data.estado ? ` (estado: ${ESTADO_MULTA_LABEL[data.estado]})` : "";
  await auditar(req, "ACTUALIZAR", "Multa", `Actualizó la multa "${multa.motivo}"${cambio}.`, multa.id);
  res.json(multa);
}

export async function eliminarMultaController(req: Request, res: Response) {
  const eliminada = await service.eliminarMulta(req.auth!.condominioId, req.params.id);
  await auditar(req, "ELIMINAR", "Multa", `Eliminó la multa "${eliminada.motivo}".`, req.params.id);
  res.status(204).send();
}
