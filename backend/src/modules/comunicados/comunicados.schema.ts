import { z } from "zod";
import { TipoComunicado } from "@prisma/client";

export const crearComunicadoSchema = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio.").max(120, "El título puede tener hasta 120 caracteres."),
  contenido: z.string().trim().min(1, "El contenido es obligatorio.").max(5000, "El contenido puede tener hasta 5000 caracteres."),
  tipo: z.enum(TipoComunicado).default(TipoComunicado.GENERAL),
});
