import { z } from "zod";
import { Rol } from "@prisma/client";

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  apellido: z.string().min(1, "El apellido es obligatorio."),
  email: z.email("Ingresa un correo válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  rol: z.enum(Rol),
  telefono: z.string().optional(),
  departamentoId: z.uuid().optional().nullable(),
});

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  telefono: z.string().optional().nullable(),
  departamentoId: z.uuid().optional().nullable(),
  activo: z.boolean().optional(),
});

export const restablecerPasswordSchema = z.object({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export const listarUsuariosQuerySchema = z.object({
  rol: z.enum(Rol).optional(),
  activo: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});
