import { EstadoAlertaSos, Rol, TipoEmergenciaSos } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ConflictError, NotFoundError } from "../../lib/errors";
import { horaEnChile } from "../../lib/fechas";
import { crearNotificacion, crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";

const EMERGENCIA_LABEL: Record<TipoEmergenciaSos, string> = {
  CARABINEROS: "Carabineros",
  BOMBEROS: "Bomberos",
  AMBULANCIA: "Ambulancia",
};

// Boton SOS (HU adicional): el residente elige el tipo de emergencia; el
// telefono del residente hace la llamada real al numero de emergencia
// (eso lo resuelve el frontend via tel:), y en paralelo se avisa a
// conserjeria/administracion para que puedan asistir (abrir reja, guiar a
// la unidad, etc.) -- nunca reemplaza la llamada real.
export async function crearAlerta(condominioId: string, usuarioId: string, tipo: TipoEmergenciaSos) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nombre: true, apellido: true, departamento: { select: { numero: true, torre: { select: { nombre: true } } } } },
  });

  const alerta = await prisma.alertaSos.create({
    data: { condominioId, usuarioId, tipo },
  });

  const destinatarios = await prisma.usuario.findMany({
    where: { condominioId, rol: { in: [Rol.ADMIN, Rol.CONSERJE] }, activo: true },
    select: { id: true },
  });

  // Ojo: no usar .trim() sobre todo el string -- se come el espacio inicial
  // que separa el apellido del "(Torre X ...)" cuando se concatenan abajo.
  const unidad = usuario?.departamento
    ? ` (${[usuario.departamento.torre?.nombre, usuario.departamento.numero].filter(Boolean).join(" ")})`
    : "";

  await crearNotificacionesMasivas(
    destinatarios.map((d) => d.id),
    {
      tipo: `SOS_${tipo}`,
      titulo: `🚨 Alerta SOS: ${EMERGENCIA_LABEL[tipo]}`,
      mensaje: usuario
        ? `${usuario.nombre} ${usuario.apellido}${unidad} activó una alerta de ${EMERGENCIA_LABEL[tipo]}.`
        : `Se activó una alerta de ${EMERGENCIA_LABEL[tipo]}.`,
      entidadTipo: "AlertaSos",
      entidadId: alerta.id,
    }
  );

  return alerta;
}

const INCLUIR = {
  usuario: { select: { id: true, nombre: true, apellido: true, departamento: { include: { torre: true } } } },
  atendidaPor: { select: { id: true, nombre: true, apellido: true, rol: true } },
} as const;

// Activas primero y despues el historial; en cada grupo, la mas reciente arriba.
export async function listarAlertas(condominioId: string) {
  return prisma.alertaSos.findMany({
    where: { condominioId },
    include: INCLUIR,
    orderBy: [{ estado: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function listarAlertasActivas(condominioId: string, cantidad = 10) {
  return prisma.alertaSos.findMany({
    where: { condominioId, estado: EstadoAlertaSos.ACTIVA },
    include: INCLUIR,
    orderBy: { createdAt: "desc" },
    take: cantidad,
  });
}

// Marca la alerta como atendida. Es atomico: si dos personas la atienden a la vez, solo una queda
// registrada y la otra recibe un aviso claro.
export async function atenderAlerta(condominioId: string, alertaId: string, atendidaPorId: string, observacion?: string) {
  const ahora = new Date();
  const { count } = await prisma.alertaSos.updateMany({
    where: { id: alertaId, condominioId, estado: EstadoAlertaSos.ACTIVA },
    data: { estado: EstadoAlertaSos.ATENDIDA, atendidaPorId, atendidaEn: ahora, observacion },
  });

  const alerta = await prisma.alertaSos.findFirst({ where: { id: alertaId, condominioId }, include: INCLUIR });
  if (!alerta) throw new NotFoundError("Alerta no encontrada.");
  if (count === 0) {
    const quien = alerta.atendidaPor ? ` por ${alerta.atendidaPor.nombre} ${alerta.atendidaPor.apellido}` : "";
    const cuando = alerta.atendidaEn ? ` a las ${horaEnChile(alerta.atendidaEn)}` : "";
    throw new ConflictError(`Esta alerta ya fue atendida${quien}${cuando}.`);
  }

  // Al residente le da tranquilidad saber que alguien acudio.
  const area = alerta.atendidaPor?.rol === Rol.ADMIN ? "administración" : "conserjería";
  await crearNotificacion({
    usuarioId: alerta.usuarioId,
    tipo: "SOS_ATENDIDA",
    titulo: "Tu alerta SOS fue atendida",
    mensaje: `${alerta.atendidaPor?.nombre ?? "El equipo"} (${area}) atendió tu alerta de ${EMERGENCIA_LABEL[alerta.tipo]} a las ${horaEnChile(ahora)}.`,
  });

  return alerta;
}
