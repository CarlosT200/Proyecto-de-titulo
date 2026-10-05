import { ahoraEnChile } from "./fechas";

// Reglas de calculo de los gastos comunes, sin base de datos (se prueban por separado).

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

// Margen para aceptar que las alicuotas "suman 100 %" (se guardan con 4 decimales).
export const TOLERANCIA_ALICUOTAS = 0.01;

// Total mensual maximo: con un fondo de reserva de hasta 100 %, ningun cobro supera el limite
// de un entero de Postgres.
export const TOTAL_MAXIMO_MES = 1_000_000_000;

// "octubre de 2026"
export function nombrePeriodo(anio: number, mes: number): string {
  return `${MESES[mes - 1]} de ${anio}`;
}

// "10 de noviembre" (para columnas @db.Date, que llegan como medianoche UTC)
export function fechaLarga(fecha: Date): string {
  return `${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]}`;
}

const formatoPesos = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
export function pesos(monto: number): string {
  return formatoPesos.format(monto);
}

export function nombreUnidad(departamento: { numero: string; torre?: { nombre: string } | null }): string {
  return [departamento.torre?.nombre, departamento.numero].filter(Boolean).join(" ");
}

// Hoy en Chile como fecha de calendario (medianoche UTC), comparable con las columnas @db.Date.
export function hoyEnChile(instante: Date = new Date()): Date {
  return new Date(`${ahoraEnChile(instante).fecha}T00:00:00.000Z`);
}

// Reparte `total` pesos entre unidades segun su peso (1 para partes iguales, o la alicuota).
// Metodo del resto mayor: cada unidad recibe la parte entera de lo que le toca y los pesos que
// sobran por redondeo van, de a uno, a las de mayor fraccion. Asi la suma calza exacto con el
// total y nadie paga mas de un peso de diferencia por redondeo.
export function repartirMonto(total: number, pesosUnidades: number[]): number[] {
  if (pesosUnidades.length === 0) return [];
  const suma = pesosUnidades.reduce((a, b) => a + b, 0);
  if (!(suma > 0)) throw new Error("Los pesos del reparto deben sumar más que cero.");

  const exactos = pesosUnidades.map((p) => (total * p) / suma);
  const montos = exactos.map((e) => Math.floor(e));
  const sobrante = total - montos.reduce((a, b) => a + b, 0);
  const porFraccion = exactos
    .map((e, i) => ({ i, fraccion: e - Math.floor(e) }))
    .sort((a, b) => b.fraccion - a.fraccion || a.i - b.i);
  for (let k = 0; k < sobrante; k++) montos[porFraccion[k % porFraccion.length].i] += 1;
  return montos;
}

// Recargo del fondo comun de reserva sobre el gasto comun de una unidad.
export function recargoFondoReserva(gastoComun: number, porcentaje: number): number {
  return Math.round((gastoComun * porcentaje) / 100);
}

export type EstadoCobro = "PAGADO" | "PENDIENTE" | "VENCIDO";

// Un cobro esta vencido desde el dia siguiente a su vencimiento (el mismo dia todavia se puede pagar).
export function estadoCobro(pagado: boolean, fechaVencimiento: Date, hoy: Date): EstadoCobro {
  if (pagado) return "PAGADO";
  return fechaVencimiento.getTime() < hoy.getTime() ? "VENCIDO" : "PENDIENTE";
}
