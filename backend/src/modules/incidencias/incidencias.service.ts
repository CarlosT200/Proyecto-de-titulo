import { EstadoIncidencia, Prisma, PrioridadIncidencia, Rol } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import { sugerirClasificacion } from "./clasificador-ia";
import { crearNotificacion, crearNotificacionesMasivas } from "../notificaciones/notificaciones.service";
import { ESTADO_INCIDENCIA_LABEL } from "../../lib/etiquetas";
import type { CategoriaIncidencia } from "../../lib/categorias";

function recortar(texto: string, largo: number): string {
  return texto.length > largo ? `${texto.slice(0, largo - 1).trimEnd()}…` : texto;
}

// HU-08: reportar incidencia.
//
// Clasificacion inicial (HU-25, RNF-14): la categoria es la que eligio el residente o, si no eligio,
// la que propone el clasificador; la prioridad es ALTA si el residente la marco como urgente y si no
// la que propone el clasificador. La administracion puede cambiar ambas en cualquier momento. La
// sugerencia original se guarda aparte (sugerenciaIA) para poder compararla.
export async function crearIncidencia(
  condominioId: string,
  usuarioId: string,
  data: {
    titulo: string;
    descripcion: string;
    ubicacion: string;
    fotoUrl?: string;
    categoria?: CategoriaIncidencia;
    urgente?: boolean;
  }
) {
  const sugerencia = sugerirClasificacion(data.titulo, data.descripcion, data.ubicacion);
  const prioridad = data.urgente ? PrioridadIncidencia.ALTA : sugerencia.prioridad;

  const incidencia = await prisma.incidencia.create({
    data: {
      condominioId,
      usuarioId,
      titulo: data.titulo,
      descripcion: data.descripcion,
      ubicacion: data.ubicacion,
      fotoUrl: data.fotoUrl,
      categoria: data.categoria ?? sugerencia.categoria,
      prioridad,
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

  // Las urgentes avisan de inmediato a la administracion (las demas se ven en el panel).
  if (prioridad === PrioridadIncidencia.ALTA) {
    const [residente, administradores] = await Promise.all([
      prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { nombre: true, apellido: true, departamento: { select: { numero: true, torre: { select: { nombre: true } } } } },
      }),
      prisma.usuario.findMany({ where: { condominioId, rol: Rol.ADMIN, activo: true }, select: { id: true } }),
    ]);
    const unidad = residente?.departamento
      ? ` (${[residente.departamento.torre?.nombre, residente.departamento.numero].filter(Boolean).join(" ")})`
      : "";
    await crearNotificacionesMasivas(
      administradores.map((a) => a.id),
      {
        tipo: "INCIDENCIA",
        titulo: "Incidencia urgente",
        mensaje: `${residente ? `${residente.nombre} ${residente.apellido}${unidad}` : "Un residente"} reportó: "${recortar(data.titulo, 80)}".`,
        entidadTipo: "Incidencia",
        entidadId: incidencia.id,
      }
    );
  }

  const { fotoUrl: _foto, ...sinFotoCreada } = incidencia;
  return sinFotoCreada;
}

// HU-09: consultar estado (residente, solo sus incidencias).
// Las listas no llevan la foto (base64, decenas de KB cada una): se ve al abrir el detalle.
function sinFoto<T extends { fotoUrl: string | null }>(incidencia: T) {
  const { fotoUrl, ...resto } = incidencia;
  return { ...resto, tieneFoto: Boolean(fotoUrl) };
}

export async function listarMisIncidencias(usuarioId: string) {
  const incidencias = await prisma.incidencia.findMany({
    where: { usuarioId },
    orderBy: { createdAt: "desc" },
  });
  return incidencias.map(sinFoto);
}

// HU-10: el administrador visualiza todas las incidencias del condominio.
export async function listarIncidenciasCondominio(
  condominioId: string,
  filtros: { estado?: EstadoIncidencia; prioridad?: PrioridadIncidencia }
) {
  const incidencias = await prisma.incidencia.findMany({
    where: { condominioId, estado: filtros.estado, prioridad: filtros.prioridad },
    include: {
      usuario: { select: { id: true, nombre: true, apellido: true, departamento: true } },
      responsable: { select: { id: true, nombre: true, apellido: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return incidencias.map(sinFoto);
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
    categoria?: CategoriaIncidencia;
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

  // El residente se entera de los cambios de estado y de los comentarios de la administracion.
  const comentario = data.observacion ? ` Comentario: "${recortar(data.observacion, 140)}"` : "";
  if (cambiaEstado && data.estado) {
    await crearNotificacion({
      usuarioId: incidencia.usuarioId,
      tipo: "INCIDENCIA",
      titulo: "Actualización de tu incidencia",
      mensaje: `Tu incidencia "${incidencia.titulo}" cambió de estado a "${ESTADO_INCIDENCIA_LABEL[data.estado]}".${comentario}`,
      entidadTipo: "Incidencia",
      entidadId: incidencia.id,
    });
  } else if (data.observacion) {
    await crearNotificacion({
      usuarioId: incidencia.usuarioId,
      tipo: "INCIDENCIA",
      titulo: "Nuevo comentario en tu incidencia",
      mensaje: `La administración comentó tu incidencia "${incidencia.titulo}": "${recortar(data.observacion, 140)}"`,
      entidadTipo: "Incidencia",
      entidadId: incidencia.id,
    });
  }

  return actualizada;
}
