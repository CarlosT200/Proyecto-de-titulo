import { EstadoEncomienda } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import { crearNotificacion } from "../notificaciones/notificaciones.service";

// HU-12: registrar encomienda. HU-13: notificar al residente automaticamente.
export async function crearEncomienda(
  condominioId: string,
  registradaPorId: string,
  data: { usuarioId: string; remitente?: string }
) {
  const residente = await prisma.usuario.findFirst({ where: { id: data.usuarioId, condominioId } });
  if (!residente) throw new NotFoundError("Residente no encontrado en este condominio.");

  const encomienda = await prisma.encomienda.create({
    data: {
      condominioId,
      registradaPorId,
      usuarioId: data.usuarioId,
      remitente: data.remitente,
      estado: EstadoEncomienda.NOTIFICADA,
    },
  });

  await crearNotificacion({
    usuarioId: data.usuarioId,
    tipo: "ENCOMIENDA",
    titulo: "Encomienda recibida",
    mensaje: data.remitente
      ? `Llegó una encomienda de ${data.remitente}. Puedes retirarla en conserjería.`
      : "Llegó una encomienda para ti. Puedes retirarla en conserjería.",
    entidadTipo: "Encomienda",
    entidadId: encomienda.id,
  });

  return encomienda;
}

export async function listarMisEncomiendas(usuarioId: string) {
  return prisma.encomienda.findMany({ where: { usuarioId }, orderBy: { fechaRecepcion: "desc" } });
}

export async function listarEncomiendasCondominio(condominioId: string, filtros: { estado?: EstadoEncomienda }) {
  return prisma.encomienda.findMany({
    where: { condominioId, estado: filtros.estado },
    include: { usuario: { select: { id: true, nombre: true, apellido: true, departamento: true } } },
    orderBy: { fechaRecepcion: "desc" },
  });
}

// HU-14: marcar como retirada.
export async function marcarRetirada(condominioId: string, encomiendaId: string) {
  const encomienda = await prisma.encomienda.findFirst({ where: { id: encomiendaId, condominioId } });
  if (!encomienda) throw new NotFoundError("Encomienda no encontrada.");

  return prisma.encomienda.update({
    where: { id: encomiendaId },
    data: { estado: EstadoEncomienda.RETIRADA, fechaRetiro: new Date() },
  });
}
