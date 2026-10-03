import { Request, Response } from "express";
import { z } from "zod";
import { ENTIDADES_AUDITADAS, listarAuditoria } from "./auditoria.service";

const listarQuerySchema = z.object({
  entidad: z.enum(ENTIDADES_AUDITADAS).optional(),
  limite: z.coerce.number().int().positive().max(500).optional(),
});

export async function listarAuditoriaController(req: Request, res: Response) {
  const filtros = listarQuerySchema.parse(req.query);
  res.json(await listarAuditoria(req.auth!.condominioId, filtros));
}
