import { z } from "zod";
import { fechaCalendario } from "../../lib/fechas";
import { EstadoMulta } from "@prisma/client";

export const crearMultaSchema = z.object({
  usuarioId: z.uuid(),
  motivo: z.string().min(1, "El motivo es obligatorio."),
  fecha: fechaCalendario,
  monto: z.number().int().positive("El monto debe ser mayor a cero."),
  observaciones: z.string().optional(),
});

export const actualizarMultaSchema = z.object({
  estado: z.enum(EstadoMulta).optional(),
  observaciones: z.string().optional(),
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
