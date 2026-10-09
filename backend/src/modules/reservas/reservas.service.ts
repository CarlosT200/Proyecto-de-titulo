import { EstadoReserva } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors";
import { ahoraEnChile } from "../../lib/fechas";

function seSuperponen(aInicio: string, aFin: string, bInicio: string, bFin: string): boolean {
  return aInicio < bFin && bInicio < aFin;
}

// Fecha (YYYY-MM-DD) y hora (HH:mm) son cadenas de ancho fijo: comparar texto equivale a comparar tiempo.
function yaPaso(fecha: string, hora: string): boolean {
  const ahora = ahoraEnChile();
  return `${fecha} ${hora}` <= `${ahora.fecha} ${ahora.hora}`;
}

// HU-04: disponibilidad del espacio común para una fecha determinada.
export async function consultarDisponibilidad(condominioId: string, espacioComunId: string, fecha: string) {
  const espacio = await prisma.espacioComun.findFirst({ where: { id: espacioComunId, condominioId } });
  if (!espacio) throw new NotFoundError("Espacio común no encontrado.");

  const reservas = await prisma.reserva.findMany({
    where: {
      espacioComunId,
      fecha: new Date(fecha),
      estado: EstadoReserva.CONFIRMADA,
    },
    select: { horaInicio: true, horaFin: true },
    orderBy: { horaInicio: "asc" },
  });

  return {
    espacio,
    horariosOcupados: reservas,
  };
}

// Calendario de un espacio: los horarios ya reservados de cada dia del rango (sin decir quien
// reservo), para que el residente vea de un vistazo que dias estan libres.
export async function consultarOcupacion(condominioId: string, espacioComunId: string, desde: string, hasta: string) {
  const espacio = await prisma.espacioComun.findFirst({
    where: { id: espacioComunId, condominioId },
    select: { id: true, nombre: true, horarioInicio: true, horarioFin: true, activo: true },
  });
  if (!espacio) throw new NotFoundError("Espacio común no encontrado.");

  const reservas = await prisma.reserva.findMany({
    where: { espacioComunId, estado: EstadoReserva.CONFIRMADA, fecha: { gte: new Date(desde), lte: new Date(hasta) } },
    select: { fecha: true, horaInicio: true, horaFin: true },
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
  });

  return {
    espacio,
    reservas: reservas.map((r) => ({ fecha: r.fecha.toISOString().slice(0, 10), horaInicio: r.horaInicio, horaFin: r.horaFin })),
  };
}

// HU-05: realizar reserva evitando conflictos (RNF-10).
export async function crearReserva(
  condominioId: string,
  usuarioId: string,
  data: { espacioComunId: string; fecha: string; horaInicio: string; horaFin: string }
) {
  const espacio = await prisma.espacioComun.findFirst({
    where: { id: data.espacioComunId, condominioId, activo: true },
  });
  if (!espacio) throw new NotFoundError("Espacio común no encontrado o no disponible.");

  if (yaPaso(data.fecha, data.horaInicio)) {
    throw new ConflictError("No puedes reservar en un horario que ya pasó. Elige una fecha y hora futuras.");
  }

  if (data.horaInicio < espacio.horarioInicio || data.horaFin > espacio.horarioFin) {
    throw new ConflictError(
      `El espacio "${espacio.nombre}" solo está disponible entre ${espacio.horarioInicio} y ${espacio.horarioFin}.`
    );
  }

  return prisma.$transaction(async (tx) => {
    // RNF-10: la revision de conflicto y la creacion tienen que ocurrir sin que otra solicitud se
    // cuele en el medio. Una transaccion normal no basta (cada una ve la tabla sin las reservas
    // todavia no confirmadas de las otras), asi que 8 solicitudes simultaneas para el mismo horario
    // quedaban las 8 confirmadas. El candado de aviso se toma por espacio y dia y se libera solo al
    // terminar la transaccion: las solicitudes para ese espacio y dia se atienden de a una.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reserva:${data.espacioComunId}:${data.fecha}`}))`;

    const existentes = await tx.reserva.findMany({
      where: {
        espacioComunId: data.espacioComunId,
        fecha: new Date(data.fecha),
        estado: EstadoReserva.CONFIRMADA,
      },
      select: { horaInicio: true, horaFin: true },
    });

    const hayConflicto = existentes.some((r) =>
      seSuperponen(data.horaInicio, data.horaFin, r.horaInicio, r.horaFin)
    );
    if (hayConflicto) {
      throw new ConflictError("El horario seleccionado ya se encuentra reservado. Elige otro horario.");
    }

    return tx.reserva.create({
      data: {
        espacioComunId: data.espacioComunId,
        usuarioId,
        fecha: new Date(data.fecha),
        horaInicio: data.horaInicio,
        horaFin: data.horaFin,
      },
      include: { espacioComun: true },
    });
  });
}

export async function listarMisReservas(usuarioId: string) {
  return prisma.reserva.findMany({
    where: { usuarioId },
    include: { espacioComun: true },
    orderBy: { fecha: "desc" },
  });
}

// El administrador puede consultar todas las reservas existentes.
export async function listarReservasCondominio(condominioId: string) {
  return prisma.reserva.findMany({
    where: { espacioComun: { condominioId } },
    include: {
      espacioComun: true,
      usuario: { select: { id: true, nombre: true, apellido: true, departamento: true } },
    },
    orderBy: { fecha: "desc" },
  });
}

export async function cancelarReserva(
  condominioId: string,
  usuarioId: string,
  rolEsAdmin: boolean,
  reservaId: string
) {
  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, espacioComun: { condominioId } },
  });
  if (!reserva) throw new NotFoundError("Reserva no encontrada.");
  if (!rolEsAdmin && reserva.usuarioId !== usuarioId) {
    throw new ForbiddenError("Solo puedes cancelar tus propias reservas.");
  }
  if (reserva.estado === EstadoReserva.CANCELADA) {
    throw new ConflictError("Esta reserva ya estaba cancelada.");
  }
  if (yaPaso(reserva.fecha.toISOString().slice(0, 10), reserva.horaFin)) {
    throw new ConflictError("Esta reserva ya finalizó, no se puede cancelar.");
  }

  return prisma.reserva.update({
    where: { id: reservaId },
    data: { estado: EstadoReserva.CANCELADA },
    include: { espacioComun: { select: { nombre: true } } },
  });
}
