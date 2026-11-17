import { z } from "zod";
import { telefono } from "../usuarios/usuarios.schema";

export const loginSchema = z.object({
  email: z.email("Ingresa un correo válido.").max(254, "Ingresa un correo válido."),
  // Tope alto para que una "contraseña" de megabytes no haga trabajar a bcrypt.
  password: z.string().min(1, "La contraseña es obligatoria.").max(128, "Correo o contraseña incorrectos."),
});

export const actualizarPerfilSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80, "El nombre puede tener hasta 80 caracteres.").optional(),
  apellido: z.string().trim().min(1, "El apellido es obligatorio.").max(80, "El apellido puede tener hasta 80 caracteres.").optional(),
  telefono: telefono.optional().nullable(),
});

export const cambiarPasswordSchema = z.object({
  actual: z.string().min(1, "Ingresa tu contraseña actual.").max(128, "La contraseña actual no es correcta."),
  nueva: z
    .string()
    .min(8, "La nueva contraseña debe tener al menos 8 caracteres.")
    .max(128, "La nueva contraseña puede tener hasta 128 caracteres."),
});
