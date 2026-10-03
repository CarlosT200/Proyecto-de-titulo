import { z } from "zod";
import { fechaCalendario } from "../../lib/fechas";

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const crearReservaSchema = z
  .object({
    espacioComunId: z.string().uuid(),
    fecha: fechaCalendario,
    horaInicio: z.string().regex(horaRegex, "Formato de hora inválido (HH:mm)."),
    horaFin: z.string().regex(horaRegex, "Formato de hora inválido (HH:mm)."),
  })
  .refine((data) => data.horaInicio < data.horaFin, {
    message: "La hora de término debe ser posterior a la hora de inicio.",
    path: ["horaFin"],
  });

export const disponibilidadQuerySchema = z.object({
  espacioComunId: z.string().uuid(),
  fecha: fechaCalendario,
});
