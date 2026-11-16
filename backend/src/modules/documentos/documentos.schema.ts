import { z } from "zod";

// Llega como multipart: un campo vacio equivale a "no informado".
export const crearDocumentoSchema = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio.").max(120, "El título puede tener hasta 120 caracteres."),
  categoria: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(60, "La categoría puede tener hasta 60 caracteres.").optional()
  ),
});
