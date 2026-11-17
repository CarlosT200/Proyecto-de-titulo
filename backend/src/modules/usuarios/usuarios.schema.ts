import { z } from "zod";
import { Rol } from "@prisma/client";

const nombre = (campo: string) =>
  z.string().trim().min(1, `El ${campo} es obligatorio.`).max(80, `El ${campo} puede tener hasta 80 caracteres.`);

// Telefono chileno o internacional: digitos, espacios, "+", guiones y parentesis. No se valida el
// formato exacto (hay muchos validos), solo que sea plausible y acotado.
export const telefono = z
  .string()
  .trim()
  .max(30, "El teléfono puede tener hasta 30 caracteres.")
  .regex(/^[+\d\s()-]*$/, "El teléfono solo puede tener números, espacios, +, guiones y paréntesis.");

// 8 a 128 caracteres: bcrypt solo usa los primeros 72 bytes, y una contraseña enorme haria lento
// el hash (abuso de CPU).
const password = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(128, "La contraseña puede tener hasta 128 caracteres.");

export const crearUsuarioSchema = z.object({
  nombre: nombre("nombre"),
  apellido: nombre("apellido"),
  email: z.email("Ingresa un correo válido.").max(254, "El correo es demasiado largo."),
  password,
  rol: z.enum(Rol),
  telefono: telefono.optional(),
  departamentoId: z.uuid().optional().nullable(),
});

export const actualizarUsuarioSchema = z.object({
  nombre: nombre("nombre").optional(),
  apellido: nombre("apellido").optional(),
  telefono: telefono.optional().nullable(),
  departamentoId: z.uuid().optional().nullable(),
  activo: z.boolean().optional(),
});

export const restablecerPasswordSchema = z.object({
  password,
});

export const listarUsuariosQuerySchema = z.object({
  rol: z.enum(Rol).optional(),
  activo: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});
