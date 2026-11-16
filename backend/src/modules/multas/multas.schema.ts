import { z } from "zod";
import { fechaCalendario } from "../../lib/fechas";
import { EstadoMulta } from "@prisma/client";

// Tope razonable para una multa de condominio (evita montos absurdos por error de tipeo).
const MONTO_MAXIMO_MULTA = 10_000_000;

export const crearMultaSchema = z.object({
  usuarioId: z.uuid(),
  motivo: z.string().trim().min(1, "El motivo es obligatorio.").max(200, "El motivo puede tener hasta 200 caracteres."),
  fecha: fechaCalendario,
  monto: z
    .number()
    .int("El monto debe ser un número entero de pesos.")
    .positive("El monto debe ser mayor a cero.")
    .max(MONTO_MAXIMO_MULTA, "El monto es demasiado alto."),
  observaciones: z.string().trim().max(1000, "Las observaciones pueden tener hasta 1000 caracteres.").optional(),
});

export const actualizarMultaSchema = z.object({
  estado: z.enum(EstadoMulta).optional(),
  observaciones: z.string().trim().max(1000, "Las observaciones pueden tener hasta 1000 caracteres.").optional(),
});

export const resolverApelacionSchema = z.object({
  decision: z.enum(["ACEPTADA", "RECHAZADA"], { error: "Elige si aceptas o rechazas la apelación." }),
  respuesta: z
    .string({ error: "Escribe la respuesta para el residente." })
    .trim()
    .min(10, "Explica con un poco más de detalle la decisión (al menos 10 letras).")
    .max(500, "La respuesta puede tener hasta 500 caracteres."),
});

export const apelarMultaSchema = z.object({
  motivo: z
    .string({ error: "Explica por qué apelas la multa." })
    .trim()
    .min(10, "Explica con un poco más de detalle por qué apelas (al menos 10 letras).")
    .max(500, "La explicación puede tener hasta 500 caracteres."),
});

export const listarMultasQuerySchema = z.object({
  estado: z.enum(EstadoMulta).optional(),
  usuarioId: z.uuid().optional(),
});
