import { ENCOMIENDA_ATRASADA_HORAS, ENCOMIENDA_MUY_ATRASADA_HORAS } from "./umbrales";

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

// "hace un momento", "hace 5 minutos", "hace 3 horas", "hace 2 días".
export function haceCuanto(fecha: string | Date, ahora: Date = new Date()): string {
  const ms = Math.max(0, ahora.getTime() - new Date(fecha).getTime());
  if (ms < MINUTO) return "hace un momento";
  if (ms < HORA) return `hace ${plural(Math.floor(ms / MINUTO), "minuto", "minutos")}`;
  if (ms < DIA) return `hace ${plural(Math.floor(ms / HORA), "hora", "horas")}`;
  return `hace ${plural(Math.floor(ms / DIA), "día", "días")}`;
}

export function horasDesde(fecha: string | Date, ahora: Date = new Date()): number {
  return (ahora.getTime() - new Date(fecha).getTime()) / HORA;
}

// Antiguedad de una encomienda pendiente: normal, atrasada (48 h) o muy atrasada (72 h).
export function nivelAntiguedad(fechaRecepcion: string | Date, ahora: Date = new Date()): "normal" | "atrasada" | "muyAtrasada" {
  const horas = horasDesde(fechaRecepcion, ahora);
  if (horas >= ENCOMIENDA_MUY_ATRASADA_HORAS) return "muyAtrasada";
  if (horas >= ENCOMIENDA_ATRASADA_HORAS) return "atrasada";
  return "normal";
}

// Duracion legible a partir de horas: "menos de 1 hora", "5 horas", "1,5 días".
export function duracionLegible(horas: number): string {
  if (horas < 1) return "menos de 1 hora";
  if (horas < 24) return plural(Math.round(horas), "hora", "horas");
  const dias = Math.round((horas / 24) * 10) / 10;
  return `${dias.toLocaleString("es-CL")} ${dias === 1 ? "día" : "días"}`;
}
