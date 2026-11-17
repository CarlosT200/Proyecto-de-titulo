import { z } from "zod";
import { fechaCalendario } from "../../lib/fechas";

// Una autorizacion de visita no deberia durar mas de 30 dias (para algo permanente se crea la cuenta).
const VIGENCIA_MAXIMA_VISITA_MS = 30 * 24 * 3600 * 1000;

export const crearVisitaSchema = z
  .object({
    nombreVisita: z
      .string()
      .trim()
      .min(1, "El nombre de la visita es obligatorio.")
      .max(120, "El nombre de la visita puede tener hasta 120 caracteres."),
    fecha: fechaCalendario,
    periodoInicio: z.iso.datetime({ error: "periodoInicio debe ser una fecha/hora ISO válida." }),
    periodoFin: z.iso.datetime({ error: "periodoFin debe ser una fecha/hora ISO válida." }),
    observaciones: z.string().trim().max(500, "Las observaciones pueden tener hasta 500 caracteres.").optional(),
    soloUnUso: z.boolean().default(false),
  })
  .refine((data) => new Date(data.periodoInicio) < new Date(data.periodoFin), {
    message: "El periodo de autorización debe terminar después de comenzar.",
    path: ["periodoFin"],
  })
  .refine((data) => new Date(data.periodoFin).getTime() - new Date(data.periodoInicio).getTime() <= VIGENCIA_MAXIMA_VISITA_MS, {
    message: "Una autorización de visita puede durar como máximo 30 días.",
    path: ["periodoFin"],
  });

// El codigo puede ser el token del QR (22 caracteres), el codigo manual (6-7) o un JWT de los QR
// antiguos (unos cientos de caracteres): 1000 cubre todos y corta entradas absurdas.
export const validarQrSchema = z.object({
  token: z.string().trim().min(1, "El token QR es obligatorio.").max(1000, "El código QR no es válido."),
});

export const crearVisitaRapidaSchema = z.object({
  nombreVisita: z.string().trim().max(120).optional(),
});
