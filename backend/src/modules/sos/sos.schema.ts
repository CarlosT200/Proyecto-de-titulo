import { z } from "zod";
import { TipoEmergenciaSos } from "@prisma/client";

export const crearAlertaSosSchema = z.object({
  tipo: z.nativeEnum(TipoEmergenciaSos),
});

export const atenderAlertaSosSchema = z.object({
  observacion: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(500, "La nota puede tener hasta 500 caracteres.").optional()
  ),
});
