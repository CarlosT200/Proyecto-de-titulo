import { Request, Response } from "express";
import { Rol } from "@prisma/client";
import {
  crearIncidenciaSchema,
  actualizarIncidenciaSchema,
  listarIncidenciasQuerySchema,
} from "./incidencias.schema";
import * as service from "./incidencias.service";
import { ForbiddenError } from "../../lib/errors";
import { auditar } from "../auditoria/auditoria.service";
import { ESTADO_INCIDENCIA_LABEL } from "../../lib/etiquetas";
import { etiquetaCategoria } from "../../lib/categorias";
import { fotoComoDataUri } from "../../lib/imagenes";

const FOTO_EVIDENCIA_LADO = 640;

export async function crearIncidenciaController(req: Request, res: Response) {
  const data = crearIncidenciaSchema.parse(req.body);
  let fotoUrl: string | undefined;
  if (req.file) {
    fotoUrl = await fotoComoDataUri(req.file.buffer, { lado: FOTO_EVIDENCIA_LADO, ajuste: "inside" });
  }
  const incidencia = await service.crearIncidencia(req.auth!.condominioId, req.auth!.sub, {
    ...data,
    fotoUrl,
  });
  res.status(201).json(incidencia);
}

export async function misIncidenciasController(req: Request, res: Response) {
  res.json(await service.listarMisIncidencias(req.auth!.sub));
}

export async function listarIncidenciasController(req: Request, res: Response) {
  const filtros = listarIncidenciasQuerySchema.parse(req.query);
  res.json(await service.listarIncidenciasCondominio(req.auth!.condominioId, filtros));
}

export async function obtenerIncidenciaController(req: Request, res: Response) {
  const incidencia = await service.obtenerIncidencia(req.auth!.condominioId, req.params.id);
  if (req.auth!.rol === Rol.RESIDENTE && incidencia.usuarioId !== req.auth!.sub) {
    throw new ForbiddenError("Solo puedes consultar tus propias incidencias.");
  }
  res.json(incidencia);
}

export async function actualizarIncidenciaController(req: Request, res: Response) {
  const data = actualizarIncidenciaSchema.parse(req.body);
  const incidencia = await service.actualizarIncidencia(
    req.auth!.condominioId,
    req.params.id,
    req.auth!.sub,
    data
  );
  const cambios = [
    data.estado && `estado: ${ESTADO_INCIDENCIA_LABEL[data.estado]}`,
    data.prioridad && `prioridad: ${data.prioridad.toLowerCase()}`,
    data.categoria && `categoría: ${etiquetaCategoria(data.categoria)}`,
  ].filter(Boolean);
  await auditar(
    req,
    "ACTUALIZAR",
    "Incidencia",
    `Actualizó la incidencia "${incidencia.titulo}"${cambios.length ? ` (${cambios.join(", ")})` : ""}.`,
    incidencia.id
  );
  res.json(incidencia);
}
