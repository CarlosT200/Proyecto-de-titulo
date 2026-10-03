import { z } from "zod";
import { TipoComunicado } from "@prisma/client";

export const crearComunicadoSchema = z.object({
  titulo: z.string().min(1, "El título es obligatorio."),
  contenido: z.string().min(1, "El contenido es obligatorio."),
  tipo: z.nativeEnum(TipoComunicado).default(TipoComunicado.GENERAL),
});
