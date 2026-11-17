import { EstadoAlertaSos, Rol, TipoEmergenciaSos } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ConflictError, NotFoundError } from "../../lib/errors";
import { horaEnChile } from "../../lib/fechas";
import { crearNotificacion, crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { enviarPushAUsuarios } from "../push/push.service";
import { logger } from "../../lib/logger";

const EMERGENCIA_LABEL: Record<TipoEmergenciaSos, string> = {
  CARABINEROS: "Carabineros",
  BOMBEROS: "Bomberos",
  AMBULANCIA: "Ambulancia",
};

// Ventana de idempotencia: si el mismo residente vuelve a pedir el mismo tipo de emergencia dentro
// de este lapso y esa alerta sigue ACTIVA, se devuelve la alerta existente en vez de crear otra.
// Cubre el doble clic, el reintento del navegador y la peticion keepalive que se repite al volver
// de la llamada. No cubre dos peticiones estrictamente simultaneas (una ventana de tiempo no es
// una restriccion unica); para eso esta ademas el limite por usuario de sos.routes.ts.
export const VENTANA_IDEMPOTENCIA_SOS_MS = 60_000;

export interface OpcionesCrearAlerta {
  // Marca los avisos como de demostracion. Lo decide el servidor (SOS_MODO_DEMO), nunca el cliente.
  modoDemo?: boolean;
}

// Boton SOS (HU adicional): el residente elige el tipo de emergencia; el
// telefono del residente hace la llamada real al numero de emergencia
// (eso lo resuelve el frontend via tel:), y en paralelo se avisa a
// conserjeria/administracion para que puedan asistir (abrir reja, guiar a
// la unidad, etc.) -- nunca reemplaza la llamada real.
//
// Devuelve la alerta y "repetida": true cuando se reutilizo una alerta reciente (ver
// VENTANA_IDEMPOTENCIA_SOS_MS); en ese caso no se vuelve a avisar a nadie.
export async function crearAlerta(
  condominioId: string,
  usuarioId: string,
  tipo: TipoEmergenciaSos,
  opciones: OpcionesCrearAlerta = {}
) {
  const reciente = await prisma.alertaSos.findFirst({
    where: {
      condominioId,
      usuarioId,
      tipo,
      estado: EstadoAlertaSos.ACTIVA,
      createdAt: { gte: new Date(Date.now() - VENTANA_IDEMPOTENCIA_SOS_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (reciente) return { ...reciente, repetida: true };

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

  const idsDestino = destinatarios.map((d) => d.id);
  // En modo demostracion el aviso lo dice en el titulo y en el texto: quien lo reciba (en la app o
  // como push) debe poder distinguir de un vistazo que no es una emergencia real.
  const demo = opciones.modoDemo === true;
  const quien = usuario
    ? `${usuario.nombre} ${usuario.apellido}${unidad} activó una alerta de ${EMERGENCIA_LABEL[tipo]}.`
    : `Se activó una alerta de ${EMERGENCIA_LABEL[tipo]}.`;
  const aviso = {
    tipo: `SOS_${tipo}`,
    titulo: `${demo ? "[DEMO] " : ""}🚨 Alerta SOS: ${EMERGENCIA_LABEL[tipo]}`,
    mensaje: demo ? `${quien} Modo demostración: no se llamó a ningún número real.` : quien,
    entidadTipo: "AlertaSos",
    entidadId: alerta.id,
  };

  // Notificar es "mejor esfuerzo": la alerta YA quedó registrada (arriba) y es visible para
  // conserjería/administración en su lista de alertas activas. En una emergencia, un fallo
  // transitorio al avisar no debe hacer que el residente crea que su SOS no salió. El push va con
  // urgencia alta para que llegue de inmediato aunque la app esté cerrada. Si falla guardar el aviso
  // en la app (p. ej. un problema puntual de base de datos), igual se intenta el push, que es el
  // canal que llega con la app cerrada.
  try {
    await crearNotificacionesMasivas(idsDestino, aviso, { urgencia: "high" });
  } catch (err) {
    logger.error("SOS: falló el aviso en la app; se intenta solo el push", { alertaId: alerta.id, error: err });
    await enviarPushAUsuarios(idsDestino, aviso, { urgencia: "high" });
  }

  return { ...alerta, repetida: false };
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
