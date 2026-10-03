import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export const actualizarPerfilSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio.").optional(),
  apellido: z.string().min(1, "El apellido es obligatorio.").optional(),
  telefono: z.string().optional().nullable(),
});

export const cambiarPasswordSchema = z.object({
  actual: z.string().min(1, "Ingresa tu contraseña actual."),
  nueva: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres."),
});
