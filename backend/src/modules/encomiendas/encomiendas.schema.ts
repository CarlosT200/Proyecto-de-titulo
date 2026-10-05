import { z } from "zod";
import { EstadoEncomienda } from "@prisma/client";

// El registro llega como multipart (puede traer foto), asi que los campos vienen como texto y un
// campo vacio equivale a "no informado".
const textoOpcional = (max: number, mensaje: string) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max, mensaje).optional());

export const crearEncomiendaSchema = z.object({
  usuarioId: z.string({ required_error: "Selecciona un residente." }).uuid("Selecciona un residente."),
  remitente: textoOpcional(80, "El remitente puede tener hasta 80 caracteres."),
  numeroSeguimiento: textoOpcional(60, "El número de seguimiento puede tener hasta 60 caracteres."),
  ubicacion: textoOpcional(60, "La ubicación puede tener hasta 60 caracteres."),
  observaciones: textoOpcional(500, "Las observaciones pueden tener hasta 500 caracteres."),
});

export const entregarEncomiendaSchema = z.object({
  // Si no se indica, se entiende que la retira el mismo residente.
  retiradaPor: textoOpcional(120, "El nombre puede tener hasta 120 caracteres."),
});

export const devolverEncomiendaSchema = z.object({
  motivo: z
    .string({ required_error: "Indica el motivo de la devolución." })
    .trim()
    .min(1, "Indica el motivo de la devolución.")
    .max(300, "El motivo puede tener hasta 300 caracteres."),
});

export const listarEncomiendasQuerySchema = z.object({
  estado: z.nativeEnum(EstadoEncomienda).optional(),
});
