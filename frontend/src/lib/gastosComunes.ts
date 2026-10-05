// Textos y calculos de gastos comunes que usa la interfaz (los montos los calcula el servidor).

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

// "octubre de 2026"
export function nombrePeriodo(anio: number, mes: number): string {
  return `${MESES[mes - 1]} de ${anio}`;
}

// "Octubre de 2026" (para titulos)
export function tituloPeriodo(anio: number, mes: number): string {
  const texto = nombrePeriodo(anio, mes);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "10 de noviembre de 2026", leyendo los digitos de la fecha (sin pasar por la zona horaria).
export function fechaLarga(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

export function nombreUnidad(unidad: { numero: string; torre: { nombre: string } | null } | null | undefined): string {
  if (!unidad) return "";
  return [unidad.torre?.nombre, unidad.numero].filter(Boolean).join(" ");
}

export function nombresResidentes(residentes: { nombre: string; apellido: string }[] | undefined): string {
  if (!residentes?.length) return "Sin residentes registrados";
  return residentes.map((r) => `${r.nombre} ${r.apellido}`).join(", ");
}

export function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

// "YYYY-MM-DD" a partir de anio, mes (1-12) y dia, ajustando el dia al largo del mes.
export function fechaIso(anio: number, mes: number, dia: number): string {
  const ultimo = new Date(anio, mes, 0).getDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}
