import { z } from "zod";
import { EstadoIncidencia, PrioridadIncidencia } from "@prisma/client";

export const crearIncidenciaSchema = z.object({
  titulo: z.string().min(1, "El título es obligatorio."),
  descripcion: z.string().min(1, "La descripción es obligatoria."),
  ubicacion: z.string().min(1, "La ubicación es obligatoria."),
});

export const actualizarIncidenciaSchema = z.object({
  estado: z.nativeEnum(EstadoIncidencia).optional(),
  prioridad: z.nativeEnum(PrioridadIncidencia).optional(),
  categoria: z.string().optional(),
  responsableId: z.string().uuid().optional().nullable(),
  observacion: z.string().optional(),
});

export const listarIncidenciasQuerySchema = z.object({
  estado: z.nativeEnum(EstadoIncidencia).optional(),
  prioridad: z.nativeEnum(PrioridadIncidencia).optional(),
});
