import { z } from "zod";

// Zona horaria del condominio. El servidor (Render) corre en UTC, asi que "hoy" y "ahora"
// se calculan explicitamente en hora de Chile; si no, entre las 21:00 y la medianoche
// el servidor creeria que ya es el dia siguiente.
export const ZONA_HORARIA = "America/Santiago";

const formato = new Intl.DateTimeFormat("sv-SE", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "ahora" en hora de Chile como { fecha: "YYYY-MM-DD", hora: "HH:mm" }.
export function ahoraEnChile(instante: Date = new Date()): { fecha: string; hora: string } {
  const [fecha, hora] = formato.format(instante).split(" ");
  return { fecha, hora };
}

// Hora "HH:mm" de un instante en hora de Chile (para los textos de las notificaciones).
export function horaEnChile(instante: Date): string {
  return ahoraEnChile(instante).hora;
}

// Instante en que empezo el dia (00:00 en Chile) que contiene a `instante`. Sirve para contar
// "lo de hoy" (accesos, etc.) sin depender de la zona horaria del servidor.
export function inicioDelDiaEnChile(instante: Date = new Date()): Date {
  const [anio, mes, dia] = ahoraEnChile(instante).fecha.split("-").map(Number);
  const medianocheUtc = Date.UTC(anio, mes - 1, dia);
  // diferencia entre la hora de Chile y UTC en ese momento (-3 h en verano, -4 h en invierno)
  const [f, h] = formato.format(new Date(medianocheUtc)).split(" ");
  const [fa, fm, fd] = f.split("-").map(Number);
  const [hh, mm] = h.split(":").map(Number);
  const desfaseMs = Date.UTC(fa, fm - 1, fd, hh, mm) - medianocheUtc;
  return new Date(medianocheUtc - desfaseMs);
}

// true si la cadena es una fecha real del calendario. El regex solo acepta la forma, asi que
// "2027-02-31" lo pasaba y new Date() la corria en silencio al 3 de marzo.
export function esFechaCalendario(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

// Campo "fecha" (YYYY-MM-DD) validado: forma correcta y dia existente.
export const fechaCalendario = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD).")
  .refine(esFechaCalendario, "La fecha no existe en el calendario.");
