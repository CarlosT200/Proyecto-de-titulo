import { Rol, TipoComunicado } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { NotFoundError } from "../../lib/errors";

// HU-15: publicar comunicado. HU-16: notificar a los residentes.
export async function crearComunicado(
  condominioId: string,
  autorId: string,
  data: { titulo: string; contenido: string; tipo: TipoComunicado }
) {
  const comunicado = await prisma.comunicado.create({
    data: { condominioId, autorId, ...data },
  });

  const residentes = await prisma.usuario.findMany({
    where: { condominioId, rol: Rol.RESIDENTE, activo: true },
    select: { id: true },
  });

  // El remitente va como titulo ("Administración") y el comunicado en el cuerpo:
  // en iPhone la notificacion push se ve como titulo / "from HabitaSmart" (lo agrega
  // iOS, no se puede quitar) / cuerpo, y asi se lee quien lo manda y que dice.
  await crearNotificacionesMasivas(
    residentes.map((r) => r.id),
    {
      tipo: "COMUNICADO",
      titulo: "Administración",
      mensaje: `${comunicado.titulo}: ${comunicado.contenido}`,
      entidadTipo: "Comunicado",
      entidadId: comunicado.id,
    }
  );

  return comunicado;
}

export async function listarComunicados(condominioId: string) {
  return prisma.comunicado.findMany({
    where: { condominioId },
    include: { autor: { select: { id: true, nombre: true, apellido: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function eliminarComunicado(condominioId: string, comunicadoId: string) {
  const comunicado = await prisma.comunicado.findFirst({
    where: { id: comunicadoId, condominioId },
    select: { titulo: true },
  });
  if (!comunicado) throw new NotFoundError("Comunicado no encontrado.");
  await prisma.comunicado.deleteMany({ where: { id: comunicadoId, condominioId } });
  return comunicado;
}
