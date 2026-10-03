import { EstadoMulta } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import { crearNotificacion } from "../notificaciones/notificaciones.service";
import { ESTADO_MULTA_LABEL } from "../../lib/etiquetas";

// HU-06: registrar multa asociada a un residente.
export async function crearMulta(
  condominioId: string,
  registradaPorId: string,
  data: { usuarioId: string; motivo: string; fecha: string; monto: number; observaciones?: string }
) {
  const residente = await prisma.usuario.findFirst({ where: { id: data.usuarioId, condominioId } });
  if (!residente) throw new NotFoundError("Residente no encontrado en este condominio.");

  const multa = await prisma.multa.create({
    data: {
      condominioId,
      registradaPorId,
      usuarioId: data.usuarioId,
      motivo: data.motivo,
      fecha: new Date(data.fecha),
      monto: data.monto,
      observaciones: data.observaciones,
    },
  });

  await crearNotificacion({
    usuarioId: data.usuarioId,
    tipo: "MULTA",
    titulo: "Nueva multa registrada",
    mensaje: `Se registró una multa: ${data.motivo}.`,
    entidadTipo: "Multa",
    entidadId: multa.id,
  });

  return multa;
}

// HU-07: el residente consulta sus propias multas.
export async function listarMisMultas(usuarioId: string) {
  return prisma.multa.findMany({ where: { usuarioId }, orderBy: { fecha: "desc" } });
}

export async function listarMultasCondominio(
  condominioId: string,
  filtros: { estado?: EstadoMulta; usuarioId?: string }
) {
  return prisma.multa.findMany({
    where: { condominioId, estado: filtros.estado, usuarioId: filtros.usuarioId },
    include: { usuario: { select: { id: true, nombre: true, apellido: true, departamento: true } } },
    orderBy: { fecha: "desc" },
  });
}

export async function actualizarMulta(
  condominioId: string,
  multaId: string,
  data: { estado?: EstadoMulta; observaciones?: string }
) {
  const multa = await prisma.multa.findFirst({ where: { id: multaId, condominioId } });
  if (!multa) throw new NotFoundError("Multa no encontrada.");

  const actualizada = await prisma.multa.update({ where: { id: multaId }, data });

  if (data.estado && data.estado !== multa.estado) {
    await crearNotificacion({
      usuarioId: multa.usuarioId,
      tipo: "MULTA",
      titulo: "Actualización de multa",
      mensaje: `Tu multa cambió de estado a ${ESTADO_MULTA_LABEL[data.estado]}.`,
      entidadTipo: "Multa",
      entidadId: multa.id,
    });
  }

  return actualizada;
}

export async function eliminarMulta(condominioId: string, multaId: string) {
  const multa = await prisma.multa.findFirst({ where: { id: multaId, condominioId }, select: { motivo: true } });
  if (!multa) throw new NotFoundError("Multa no encontrada.");
  await prisma.multa.deleteMany({ where: { id: multaId, condominioId } });
  return multa;
}
