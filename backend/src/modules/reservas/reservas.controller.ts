import { Request, Response } from "express";
import { Rol } from "@prisma/client";
import { crearReservaSchema, disponibilidadQuerySchema, ocupacionQuerySchema } from "./reservas.schema";
import * as reservasService from "./reservas.service";
import { auditar } from "../auditoria/auditoria.service";

export async function disponibilidadController(req: Request, res: Response) {
  const { espacioComunId, fecha } = disponibilidadQuerySchema.parse(req.query);
  res.json(await reservasService.consultarDisponibilidad(req.auth!.condominioId, espacioComunId, fecha));
}

export async function ocupacionController(req: Request, res: Response) {
  const { espacioComunId, desde, hasta } = ocupacionQuerySchema.parse(req.query);
  res.json(await reservasService.consultarOcupacion(req.auth!.condominioId, espacioComunId, desde, hasta));
}

export async function crearReservaController(req: Request, res: Response) {
  const data = crearReservaSchema.parse(req.body);
  const reserva = await reservasService.crearReserva(req.auth!.condominioId, req.auth!.sub, data);
  res.status(201).json(reserva);
}

export async function misReservasController(req: Request, res: Response) {
  res.json(await reservasService.listarMisReservas(req.auth!.sub));
}

export async function listarReservasController(req: Request, res: Response) {
  res.json(await reservasService.listarReservasCondominio(req.auth!.condominioId));
}

export async function cancelarReservaController(req: Request, res: Response) {
  const rolEsAdmin = req.auth!.rol === Rol.ADMIN;
  const reserva = await reservasService.cancelarReserva(
    req.auth!.condominioId,
    req.auth!.sub,
    rolEsAdmin,
    req.params.id
  );
  // Solo se deja rastro cuando la cancelacion la hace la administracion sobre la reserva de otra persona
  if (rolEsAdmin && reserva.usuarioId !== req.auth!.sub) {
    const fecha = reserva.fecha.toISOString().slice(0, 10);
    await auditar(req, "CANCELAR", "Reserva", `Canceló una reserva de "${reserva.espacioComun.nombre}" del ${fecha}.`, reserva.id);
  }
  res.json(reserva);
}
