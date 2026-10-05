import { z } from "zod";
import { EstadoIncidencia, PrioridadIncidencia } from "@prisma/client";
import { CODIGOS_CATEGORIA } from "../../lib/categorias";

// El formulario llega como multipart (puede traer foto), asi que todo viene como texto.
const textoOpcional = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

export const crearIncidenciaSchema = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio.").max(120, "El título puede tener hasta 120 caracteres."),
  descripcion: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria.")
    .max(2000, "La descripción puede tener hasta 2000 caracteres."),
  ubicacion: z.string().trim().min(1, "La ubicación es obligatoria.").max(120, "La ubicación puede tener hasta 120 caracteres."),
  // Opcional: si la persona no elige, la clasificacion automatica propone una.
  categoria: z.preprocess((v) => (v === "" ? undefined : v), z.enum(CODIGOS_CATEGORIA).optional()),
  urgente: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
});

export const actualizarIncidenciaSchema = z.object({
  estado: z.nativeEnum(EstadoIncidencia).optional(),
  prioridad: z.nativeEnum(PrioridadIncidencia).optional(),
  categoria: z.enum(CODIGOS_CATEGORIA).optional(),
  responsableId: z.string().uuid().optional().nullable(),
  observacion: textoOpcional(1000),
});

export const listarIncidenciasQuerySchema = z.object({
  estado: z.nativeEnum(EstadoIncidencia).optional(),
  prioridad: z.nativeEnum(PrioridadIncidencia).optional(),
});
