import { Request, Response } from "express";
import { atenderAlertaSosSchema, crearAlertaSosSchema } from "./sos.schema";
import * as service from "./sos.service";
import { auditar } from "../auditoria/auditoria.service";

const EMERGENCIA_LABEL = { CARABINEROS: "Carabineros", BOMBEROS: "Bomberos", AMBULANCIA: "Ambulancia" } as const;

export async function crearAlertaController(req: Request, res: Response) {
  const { tipo } = crearAlertaSosSchema.parse(req.body);
  const alerta = await service.crearAlerta(req.auth!.condominioId, req.auth!.sub, tipo);
  res.status(201).json(alerta);
}

export async function listarAlertasController(req: Request, res: Response) {
  res.json(await service.listarAlertas(req.auth!.condominioId));
}

export async function atenderAlertaController(req: Request, res: Response) {
  const { observacion } = atenderAlertaSosSchema.parse(req.body ?? {});
  const alerta = await service.atenderAlerta(req.auth!.condominioId, req.params.id, req.auth!.sub, observacion);
  await auditar(
    req,
    "ACTUALIZAR",
    "AlertaSos",
    `Atendió la alerta SOS de ${alerta.usuario.nombre} ${alerta.usuario.apellido} (${EMERGENCIA_LABEL[alerta.tipo]}).`,
    alerta.id
  );
  res.json(alerta);
}
