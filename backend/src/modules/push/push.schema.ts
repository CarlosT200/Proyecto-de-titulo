import { z } from "zod";

export const suscripcionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const eliminarSuscripcionSchema = z.object({
  endpoint: z.url(),
});
