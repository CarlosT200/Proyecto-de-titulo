import { z } from "zod";

export const actualizarCondominioSchema = z.object({
  nombre: z.string().min(1).optional(),
  direccion: z.string().optional().nullable(),
  comuna: z.string().optional().nullable(),
});

export const crearTorreSchema = z.object({
  nombre: z.string().min(1, "El nombre de la torre es obligatorio."),
});

export const crearDepartamentoSchema = z.object({
  numero: z.string().min(1, "El número de departamento es obligatorio."),
  torreId: z.string().uuid().optional().nullable(),
});

export const crearEspacioComunSchema = z.object({
  nombre: z.string().min(1, "El nombre del espacio es obligatorio."),
  descripcion: z.string().optional(),
  capacidad: z.number().int().positive().optional(),
  horarioInicio: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido (HH:mm)."),
  horarioFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido (HH:mm)."),
});

export const actualizarEspacioComunSchema = crearEspacioComunSchema.partial().extend({
  activo: z.boolean().optional(),
});
