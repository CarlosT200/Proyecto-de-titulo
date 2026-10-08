import { EstadoMulta, Rol } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors";
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

  // Una apelacion se resuelve aceptandola o rechazandola con una respuesta (resolverApelacion): asi
  // el residente siempre sabe por que se decidio lo que se decidio.
  if (multa.estado === EstadoMulta.APELADA && data.estado && data.estado !== EstadoMulta.APELADA) {
    throw new AppError("Esta multa está apelada: para resolverla acepta o rechaza la apelación y escribe la respuesta para el residente.", 422);
  }

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

  // "apeladaEn: null": una multa se apela una sola vez (si la administracion la rechazo, vuelve a
  // quedar pendiente pero ya no se puede apelar de nuevo).
  const { count } = await prisma.multa.updateMany({
    where: { id: multaId, usuarioId, estado: EstadoMulta.PENDIENTE, apeladaEn: null },
    data: { estado: EstadoMulta.APELADA, apelacion: motivo, apeladaEn: new Date() },
  });
  if (count === 0) {
    const actual = await prisma.multa.findFirst({ where: { id: multaId, usuarioId }, select: { estado: true, apeladaEn: true } });
    throw new ConflictError(
      actual?.apeladaEn && actual.estado === EstadoMulta.PENDIENTE
        ? "Esta multa ya fue apelada y la administración respondió. No se puede apelar de nuevo."
        : "Solo se puede apelar una multa pendiente. Esta ya fue apelada o la administración la resolvió."
    );
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

// La administracion responde una apelacion: la acepta (la multa se anula) o la rechaza (la multa sigue
// pendiente) y escribe la respuesta que ve el residente. La condicion "sigue apelada" va en el mismo
// UPDATE: si dos administradores responden a la vez, o ya estaba resuelta, solo una respuesta gana.
export async function resolverApelacion(
  condominioId: string,
  multaId: string,
  data: { decision: "ACEPTADA" | "RECHAZADA"; respuesta: string }
) {
  const multa = await prisma.multa.findFirst({ where: { id: multaId, condominioId }, select: { id: true, usuarioId: true, motivo: true } });
  if (!multa) throw new NotFoundError("Multa no encontrada.");

  const aceptada = data.decision === "ACEPTADA";
  const { count } = await prisma.multa.updateMany({
    where: { id: multaId, condominioId, estado: EstadoMulta.APELADA },
    data: {
      estado: aceptada ? EstadoMulta.ANULADA : EstadoMulta.PENDIENTE,
      apelacionAceptada: aceptada,
      respuesta: data.respuesta,
      respondidaEn: new Date(),
    },
  });
  if (count === 0) throw new ConflictError("Esta multa no tiene una apelación por resolver. Quizás otra persona ya la respondió.");

  await crearNotificacion({
    usuarioId: multa.usuarioId,
    tipo: "MULTA",
    titulo: aceptada ? "Apelación aceptada" : "Apelación rechazada",
    mensaje: aceptada
      ? `La administración aceptó tu apelación: la multa "${multa.motivo}" quedó anulada. Respuesta: ${data.respuesta}`
      : `La administración rechazó tu apelación: la multa "${multa.motivo}" sigue pendiente. Respuesta: ${data.respuesta}`,
    entidadTipo: "Multa",
    entidadId: multa.id,
  });

  return { motivo: multa.motivo, aceptada };
}

export async function eliminarMulta(condominioId: string, multaId: string) {
  const multa = await prisma.multa.findFirst({ where: { id: multaId, condominioId }, select: { motivo: true } });
  if (!multa) throw new NotFoundError("Multa no encontrada.");
  await prisma.multa.deleteMany({ where: { id: multaId, condominioId } });
  return multa;
}
