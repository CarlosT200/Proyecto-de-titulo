import { prisma } from "../../lib/prisma";
import { enviarPushAUsuarios, type OpcionesPush } from "../push/push.service";

// Soporte transversal para HU-13 (aviso de encomienda) y HU-16 (recibir comunicados).
// Ademas de guardar la notificacion en la app, intenta un push real (ver
// push.service.ts) a cada dispositivo suscrito del usuario -- si no hay
// suscripcion o el modulo no esta configurado, enviarPushAUsuarios no hace
// nada, asi que esto es seguro de llamar siempre.
export async function crearNotificacion(
  data: {
    usuarioId: string;
    tipo: string;
    titulo: string;
    mensaje: string;
    entidadTipo?: string;
    entidadId?: string;
  },
  opcionesPush?: OpcionesPush
) {
  const notificacion = await prisma.notificacion.create({ data });
  await enviarPushAUsuarios([data.usuarioId], data, opcionesPush);
  return notificacion;
}

export async function crearNotificacionesMasivas(
  usuarioIds: string[],
  data: { tipo: string; titulo: string; mensaje: string; entidadTipo?: string; entidadId?: string },
  opcionesPush?: OpcionesPush
) {
  if (usuarioIds.length === 0) return;
  await prisma.notificacion.createMany({
    data: usuarioIds.map((usuarioId) => ({ usuarioId, ...data })),
  });
  await enviarPushAUsuarios(usuarioIds, data, opcionesPush);
}

export async function listarNotificaciones(usuarioId: string) {
  return prisma.notificacion.findMany({
    where: { usuarioId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function marcarLeida(usuarioId: string, notificacionId: string) {
  return prisma.notificacion.updateMany({
    where: { id: notificacionId, usuarioId },
    data: { leida: true },
  });
}

export async function marcarTodasLeidas(usuarioId: string) {
  return prisma.notificacion.updateMany({
    where: { usuarioId, leida: false },
    data: { leida: true },
  });
}

export async function eliminarNotificacion(usuarioId: string, notificacionId: string) {
  return prisma.notificacion.deleteMany({ where: { id: notificacionId, usuarioId } });
}

export async function eliminarTodasNotificaciones(usuarioId: string) {
  return prisma.notificacion.deleteMany({ where: { usuarioId } });
}
