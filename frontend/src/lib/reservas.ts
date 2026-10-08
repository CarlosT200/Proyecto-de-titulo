import { hoyLocal, reservaFinalizada } from "./format";
import type { EspacioComun, Reserva } from "../types";

export type EstadoReservaVisible = "CONFIRMADA" | "CANCELADA" | "FINALIZADA";

// Una confirmada cuyo horario ya termino se muestra como "Finalizada".
export function estadoVisible(r: Reserva): EstadoReservaVisible {
  return reservaFinalizada(r) ? "FINALIZADA" : r.estado;
}

// Confirmada y que todavia no termina (puede ser de hoy a una hora posterior o de otro dia).
export function esProxima(r: Reserva): boolean {
  return r.estado === "CONFIRMADA" && !reservaFinalizada(r);
}

export function esDeHoy(r: Reserva): boolean {
  return esProxima(r) && r.fecha.slice(0, 10) === hoyLocal();
}

// Lo proximo primero, de la mas cercana a la mas lejana; lo demas (finalizadas y canceladas) despues,
// de la mas reciente a la mas antigua.
export function ordenarReservas(lista: Reserva[]): Reserva[] {
  const clave = (r: Reserva) => `${r.fecha.slice(0, 10)} ${r.horaInicio}`;
  return [...lista].sort((a, b) => {
    const aProxima = esProxima(a);
    const bProxima = esProxima(b);
    if (aProxima !== bProxima) return aProxima ? -1 : 1;
    return aProxima ? clave(a).localeCompare(clave(b)) : clave(b).localeCompare(clave(a));
  });
}

function aFechaLocal(fecha: string): Date {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

// "Hoy", "Mañana" o "En 5 días" (para fechas pasadas, la fecha corta).
export function cuandoEs(fecha: string): string {
  const [anio, mes, dia] = hoyLocal().split("-").map(Number);
  const dias = Math.round((aFechaLocal(fecha).getTime() - new Date(anio, mes - 1, dia).getTime()) / 86_400_000);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias > 1) return `En ${dias} días`;
  return "Ya pasó";
}

// "Jueves 8 de octubre"
export function fechaConDia(fecha: string): string {
  const texto = aFechaLocal(fecha).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const aMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

// Aviso (no bloquea el envio: la decision es del servidor) cuando el horario elegido no se puede
// reservar: termina antes de empezar, ya paso, queda fuera del horario del espacio o se cruza con otra reserva.
export function avisoDeHorario(
  espacio: EspacioComun | undefined,
  fecha: string,
  horaInicio: string,
  horaFin: string,
  ocupados: { horaInicio: string; horaFin: string }[]
): string | null {
  if (!espacio || !horaInicio || !horaFin) return null;
  const inicio = aMinutos(horaInicio);
  const fin = aMinutos(horaFin);
  if (fin <= inicio) return "La hora de término debe ser posterior a la hora de inicio.";
  if (fecha === hoyLocal()) {
    const ahora = new Date();
    if (inicio <= ahora.getHours() * 60 + ahora.getMinutes()) return "Ese horario de hoy ya comenzó o pasó. Elige una hora futura.";
  }
  if (inicio < aMinutos(espacio.horarioInicio) || fin > aMinutos(espacio.horarioFin)) {
    return `${espacio.nombre} se puede reservar de ${espacio.horarioInicio} a ${espacio.horarioFin}: el horario elegido queda fuera.`;
  }
  const cruce = ocupados.find((o) => inicio < aMinutos(o.horaFin) && fin > aMinutos(o.horaInicio));
  if (cruce) return `Se cruza con una reserva existente (${cruce.horaInicio} - ${cruce.horaFin}). Elige otro horario.`;
  return null;
}
