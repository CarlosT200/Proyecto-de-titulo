import { z } from "zod";
import { fechaCalendario } from "../../lib/fechas";

export const crearVisitaSchema = z
  .object({
    nombreVisita: z.string().min(1, "El nombre de la visita es obligatorio."),
    fecha: fechaCalendario,
    periodoInicio: z.string().datetime({ message: "periodoInicio debe ser una fecha/hora ISO válida." }),
    periodoFin: z.string().datetime({ message: "periodoFin debe ser una fecha/hora ISO válida." }),
    observaciones: z.string().optional(),
    soloUnUso: z.boolean().default(false),
  })
  .refine((data) => new Date(data.periodoInicio) < new Date(data.periodoFin), {
    message: "El periodo de autorización debe terminar después de comenzar.",
    path: ["periodoFin"],
  });

export const validarQrSchema = z.object({
  token: z.string().min(1, "El token QR es obligatorio."),
});

export const crearVisitaRapidaSchema = z.object({
  nombreVisita: z.string().trim().max(120).optional(),
});
