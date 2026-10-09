import { Request, Response } from "express";
import { crearVisitaRapidaSchema, crearVisitaSchema, validarQrSchema } from "./qr.schema";
import * as service from "./qr.service";

export async function generarQrResidenteController(req: Request, res: Response) {
  res.json(await service.generarQrResidente(req.auth!.condominioId, req.auth!.sub));
}

export async function crearVisitaController(req: Request, res: Response) {
  const data = crearVisitaSchema.parse(req.body);
  const visita = await service.crearVisita(req.auth!.condominioId, req.auth!.sub, data);
  res.status(201).json(visita);
}

export async function misVisitasController(req: Request, res: Response) {
  res.json(await service.listarMisVisitas(req.auth!.sub));
}

export async function generarQrVisitaController(req: Request, res: Response) {
  const qr = await service.generarQrVisita(req.auth!.condominioId, req.auth!.sub, req.params.id);
  res.json(qr);
}

export async function verQrVisitaController(req: Request, res: Response) {
  res.json(await service.verQrVisita(req.auth!.condominioId, req.auth!.sub, req.params.id));
}

export async function crearVisitaRapidaController(req: Request, res: Response) {
  const { nombreVisita } = crearVisitaRapidaSchema.parse(req.body ?? {});
  const visita = await service.crearVisitaRapida(req.auth!.condominioId, req.auth!.sub, nombreVisita);
  res.status(201).json(visita);
}

export async function revocarVisitaController(req: Request, res: Response) {
  res.json(await service.revocarVisita(req.auth!.condominioId, req.auth!.sub, req.params.id));
}

export async function validarQrController(req: Request, res: Response) {
  const { token } = validarQrSchema.parse(req.body);
  const resultado = await service.validarQr(req.auth!.condominioId, req.auth!.sub, token);
  res.json(resultado);
}

export async function listarAccesosController(req: Request, res: Response) {
  res.json(await service.listarAccesos(req.auth!.condominioId));
}
