import { EstadoMulta, Rol } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ConflictError, NotFoundError } from "../../lib/errors";
import { crearNotificacion, crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
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

// El residente apela una multa suya que sigue pendiente: pasa a "Apelada" con su explicacion y se
// avisa a la administracion. La condicion va en el mismo UPDATE: si la administracion la marca como
// pagada o anulada al mismo tiempo, o se envia dos veces, solo uno gana y el otro recibe un 409.
export async function apelarMulta(usuarioId: string, multaId: string, motivo: string) {
  const multa = await prisma.multa.findFirst({
    where: { id: multaId, usuarioId },
    select: { id: true, condominioId: true, motivo: true, usuario: { select: { nombre: true, apellido: true } } },
  });
  if (!multa) throw new NotFoundError("Multa no encontrada.");

  const { count } = await prisma.multa.updateMany({
    where: { id: multaId, usuarioId, estado: EstadoMulta.PENDIENTE },
    data: { estado: EstadoMulta.APELADA, apelacion: motivo, apeladaEn: new Date() },
  });
  if (count === 0) {
    throw new ConflictError("Solo se puede apelar una multa pendiente. Esta ya fue apelada o la administración la resolvió.");
  }

  const admins = await prisma.usuario.findMany({
    where: { condominioId: multa.condominioId, rol: Rol.ADMIN, activo: true },
    select: { id: true },
  });
  await crearNotificacionesMasivas(
    admins.map((a) => a.id),
    {
      tipo: "MULTA",
      titulo: "Multa apelada",
      mensaje: `${multa.usuario.nombre} ${multa.usuario.apellido} apeló la multa "${multa.motivo}".`,
      entidadTipo: "Multa",
      entidadId: multa.id,
    }
  );

  return { motivo: multa.motivo };
}

export async function eliminarMulta(condominioId: string, multaId: string) {
  const multa = await prisma.multa.findFirst({ where: { id: multaId, condominioId }, select: { motivo: true } });
  if (!multa) throw new NotFoundError("Multa no encontrada.");
  await prisma.multa.deleteMany({ where: { id: multaId, condominioId } });
  return multa;
}
