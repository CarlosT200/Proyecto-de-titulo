import { z } from "zod";

const textoOpcional = (max: number) => z.string().trim().max(max, `Puede tener hasta ${max} caracteres.`);

export const actualizarCondominioSchema = z.object({
  nombre: z.string().trim().min(1).max(120, "El nombre puede tener hasta 120 caracteres.").optional(),
  direccion: textoOpcional(200).optional().nullable(),
  comuna: textoOpcional(80).optional().nullable(),
});

export const crearTorreSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre de la torre es obligatorio.").max(60, "El nombre puede tener hasta 60 caracteres."),
});

export const crearDepartamentoSchema = z.object({
  numero: z.string().trim().min(1, "El número de departamento es obligatorio.").max(20, "El número puede tener hasta 20 caracteres."),
  torreId: z.uuid().optional().nullable(),
});

const aMinutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

// Un espacio que cierra antes de abrir no se podria reservar nunca.
const horarioCoherente = (d: { horarioInicio?: string; horarioFin?: string }) =>
  !d.horarioInicio || !d.horarioFin || aMinutos(d.horarioFin) > aMinutos(d.horarioInicio);
const MENSAJE_HORARIO = { message: "El horario de término debe ser posterior al de inicio.", path: ["horarioFin"] };

const espacioComunBase = z.object({
  nombre: z.string().trim().min(1, "El nombre del espacio es obligatorio.").max(80, "El nombre puede tener hasta 80 caracteres."),
  descripcion: textoOpcional(500).optional(),
  capacidad: z.number().int().positive().max(10000).optional(),
  horarioInicio: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido (HH:mm)."),
  horarioFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido (HH:mm)."),
});

export const crearEspacioComunSchema = espacioComunBase.refine(horarioCoherente, MENSAJE_HORARIO);

export const actualizarEspacioComunSchema = espacioComunBase
  .partial()
  .extend({ activo: z.boolean().optional() })
  .refine(horarioCoherente, MENSAJE_HORARIO);
