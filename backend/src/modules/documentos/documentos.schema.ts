import { z } from "zod";

export const crearDocumentoSchema = z.object({
  titulo: z.string().min(1, "El título es obligatorio."),
  categoria: z.string().optional(),
});
