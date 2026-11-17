import { z } from "zod";

// Los servicios de push (Google, Mozilla, Apple) siempre entregan un endpoint https.
const endpoint = z.url({ protocol: /^https$/ }).max(1000);

export const suscripcionSchema = z.object({
  endpoint,
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

export const eliminarSuscripcionSchema = z.object({
  endpoint,
});
