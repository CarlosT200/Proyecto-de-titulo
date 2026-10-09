import { hoyLocal } from "./format";
import { nivelAntiguedad } from "./tiempo";
import type { Encomienda } from "../types";

export const esPorRetirar = (e: Pick<Encomienda, "estado">) => e.estado === "NOTIFICADA";

// Por retirar desde hace 48 h o mas.
export const esAtrasada = (e: Pick<Encomienda, "estado" | "fechaRecepcion">) =>
  e.estado === "NOTIFICADA" && nivelAntiguedad(e.fechaRecepcion) !== "normal";

function diaLocal(fecha: string): string {
  const d = new Date(fecha);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export const retiradaHoy = (e: Pick<Encomienda, "estado" | "fechaRetiro">) =>
  e.estado === "RETIRADA" && !!e.fechaRetiro && diaLocal(e.fechaRetiro) === hoyLocal();

// Lo que sigue por retirar primero, de la mas antigua (la que mas urge) a la mas reciente; despues el
// historial, de la mas reciente a la mas antigua.
export function ordenarEncomiendas<T extends Pick<Encomienda, "estado" | "fechaRecepcion">>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const aPendiente = esPorRetirar(a);
    const bPendiente = esPorRetirar(b);
    if (aPendiente !== bPendiente) return aPendiente ? -1 : 1;
    const dif = new Date(a.fechaRecepcion).getTime() - new Date(b.fechaRecepcion).getTime();
    return aPendiente ? dif : -dif;
  });
}
