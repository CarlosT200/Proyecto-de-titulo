import type { AlertaSos } from "../types";

// "Torre A 101" de la persona que activo una alerta SOS (null si no tiene unidad asignada).
export function unidadDeAlerta(a: AlertaSos): string | null {
  if (!a.usuario.departamento) return null;
  return [a.usuario.departamento.torre?.nombre, a.usuario.departamento.numero].filter(Boolean).join(" ");
}
