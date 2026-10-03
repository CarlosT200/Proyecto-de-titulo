import { Request, Response } from "express";
import {
  actualizarCondominioSchema,
  crearTorreSchema,
  crearDepartamentoSchema,
  crearEspacioComunSchema,
  actualizarEspacioComunSchema,
} from "./condominio.schema";
import * as condominioService from "./condominio.service";
import { auditar } from "../auditoria/auditoria.service";

export async function obtenerCondominioController(req: Request, res: Response) {
  res.json(await condominioService.obtenerCondominio(req.auth!.condominioId));
}

export async function actualizarCondominioController(req: Request, res: Response) {
  const data = actualizarCondominioSchema.parse(req.body);
  const condominio = await condominioService.actualizarCondominio(req.auth!.condominioId, data);
  await auditar(req, "ACTUALIZAR", "Condominio", "Actualizó los datos del condominio.", condominio.id);
  res.json(condominio);
}

export async function crearTorreController(req: Request, res: Response) {
  const { nombre } = crearTorreSchema.parse(req.body);
  const torre = await condominioService.crearTorre(req.auth!.condominioId, nombre);
  await auditar(req, "CREAR", "Condominio", `Creó la torre "${torre.nombre}".`, torre.id);
  res.status(201).json(torre);
}

export async function listarTorresController(req: Request, res: Response) {
  res.json(await condominioService.listarTorres(req.auth!.condominioId));
}

export async function crearDepartamentoController(req: Request, res: Response) {
  const data = crearDepartamentoSchema.parse(req.body);
  const departamento = await condominioService.crearDepartamento(req.auth!.condominioId, data);
  await auditar(req, "CREAR", "Condominio", `Creó el departamento ${departamento.numero}.`, departamento.id);
  res.status(201).json(departamento);
}

export async function listarDepartamentosController(req: Request, res: Response) {
  res.json(await condominioService.listarDepartamentos(req.auth!.condominioId));
}

export async function crearEspacioComunController(req: Request, res: Response) {
  const data = crearEspacioComunSchema.parse(req.body);
  const espacio = await condominioService.crearEspacioComun(req.auth!.condominioId, data);
  await auditar(req, "CREAR", "Condominio", `Creó el espacio común "${espacio.nombre}".`, espacio.id);
  res.status(201).json(espacio);
}

export async function listarEspaciosComunesController(req: Request, res: Response) {
  const soloActivos = req.query.activos === "true";
  res.json(await condominioService.listarEspaciosComunes(req.auth!.condominioId, soloActivos));
}

export async function actualizarEspacioComunController(req: Request, res: Response) {
  const data = actualizarEspacioComunSchema.parse(req.body);
  const espacio = await condominioService.actualizarEspacioComun(req.auth!.condominioId, req.params.id, data);
  const estado = data.activo === undefined ? "" : data.activo ? " (lo activó)" : " (lo desactivó)";
  await auditar(req, "ACTUALIZAR", "Condominio", `Actualizó el espacio común "${espacio.nombre}"${estado}.`, espacio.id);
  res.json(espacio);
}
