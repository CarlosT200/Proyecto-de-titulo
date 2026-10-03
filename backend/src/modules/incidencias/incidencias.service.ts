import { EstadoIncidencia, Prisma, PrioridadIncidencia } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import { sugerirClasificacion } from "./clasificador-ia";
import { crearNotificacion } from "../notificaciones/notificaciones.service";
import { ESTADO_INCIDENCIA_LABEL } from "../../lib/etiquetas";

// HU-08: reportar incidencia.
export async function crearIncidencia(
  condominioId: string,
  usuarioId: string,
  data: { titulo: string; descripcion: string; ubicacion: string; fotoUrl?: string }
) {
  const sugerencia = sugerirClasificacion(data.titulo, data.descripcion, data.ubicacion);

  const incidencia = await prisma.incidencia.create({
    data: {
      condominioId,
      usuarioId,
      titulo: data.titulo,
      descripcion: data.descripcion,
      ubicacion: data.ubicacion,
      fotoUrl: data.fotoUrl,
      // HU-25: la sugerencia se guarda de inmediato, pero no vincula al administrador (RNF-14).
      sugerenciaIA: sugerencia as unknown as Prisma.InputJsonValue,
      historial: {
        create: {
          estadoNuevo: EstadoIncidencia.REPORTADA,
          usuarioId,
          observacion: "Incidencia reportada por el residente.",
        },
      },
    },
    include: { historial: true },
  });

  return incidencia;
}

// HU-09: consultar estado (residente, solo sus incidencias).
export async function listarMisIncidencias(usuarioId: string) {
  return prisma.incidencia.findMany({
    where: { usuarioId },
    orderBy: { createdAt: "desc" },
  });
}

// HU-10: el administrador visualiza todas las incidencias del condominio.
export async function listarIncidenciasCondominio(
  condominioId: string,
  filtros: { estado?: EstadoIncidencia; prioridad?: PrioridadIncidencia }
) {
  return prisma.incidencia.findMany({
    where: { condominioId, estado: filtros.estado, prioridad: filtros.prioridad },
    include: {
      usuario: { select: { id: true, nombre: true, apellido: true, departamento: true } },
      responsable: { select: { id: true, nombre: true, apellido: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// HU-11: historial de una incidencia.
export async function obtenerIncidencia(condominioId: string, incidenciaId: string) {
  const incidencia = await prisma.incidencia.findFirst({
    where: { id: incidenciaId, condominioId },
    include: {
      usuario: { select: { id: true, nombre: true, apellido: true, departamento: true } },
      responsable: { select: { id: true, nombre: true, apellido: true } },
      historial: {
        orderBy: { createdAt: "asc" },
        include: { usuario: { select: { id: true, nombre: true, apellido: true } } },
      },
    },
  });
  if (!incidencia) throw new NotFoundError("Incidencia no encontrada.");
  return incidencia;
}

// HU-10: gestionar (clasificar, priorizar, cambiar estado, asignar responsable).
export async function actualizarIncidencia(
  condominioId: string,
  incidenciaId: string,
  usuarioQueActualizaId: string,
  data: {
    estado?: EstadoIncidencia;
    prioridad?: PrioridadIncidencia;
    categoria?: string;
    responsableId?: string | null;
    observacion?: string;
  }
) {
  const incidencia = await prisma.incidencia.findFirst({ where: { id: incidenciaId, condominioId } });
  if (!incidencia) throw new NotFoundError("Incidencia no encontrada.");

  const cambiaEstado = data.estado && data.estado !== incidencia.estado;

  const actualizada = await prisma.incidencia.update({
    where: { id: incidenciaId },
    data: {
      estado: data.estado,
      prioridad: data.prioridad,
      categoria: data.categoria,
      responsableId: data.responsableId,
      ...(cambiaEstado || data.observacion
        ? {
            historial: {
              create: {
                estadoAnterior: incidencia.estado,
                estadoNuevo: data.estado ?? incidencia.estado,
                usuarioId: usuarioQueActualizaId,
                observacion: data.observacion,
              },
            },
          }
        : {}),
    },
  });

  if (cambiaEstado && data.estado) {
    await crearNotificacion({
      usuarioId: incidencia.usuarioId,
      tipo: "INCIDENCIA",
      titulo: "Actualización de tu incidencia",
      mensaje: `Tu incidencia "${incidencia.titulo}" cambió de estado a "${ESTADO_INCIDENCIA_LABEL[data.estado]}".`,
      entidadTipo: "Incidencia",
      entidadId: incidencia.id,
    });
  }

  return actualizada;
}
