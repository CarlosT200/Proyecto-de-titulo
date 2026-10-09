import { hoyLocal } from "./format";

// Dia local (YYYY-MM-DD) de un instante.
export function diaLocal(instante: string | Date): string {
  const d = typeof instante === "string" ? new Date(instante) : instante;
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

// "Hoy", "Ayer" o "Lunes 5 de octubre" (con el año si no es el actual).
export function etiquetaDia(dia: string): string {
  const hoy = hoyLocal();
  const [a, m, d] = hoy.split("-").map(Number);
  const ayer = diaLocal(new Date(a, m - 1, d - 1));
  if (dia === hoy) return "Hoy";
  if (dia === ayer) return "Ayer";
  const [anio, mes, numero] = dia.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, numero);
  const texto = fecha.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(anio !== a ? { year: "numeric" } : {}),
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Agrupa una lista (ya ordenada de lo mas nuevo a lo mas antiguo) por dia local, conservando el orden.
export function agruparPorDia<T>(lista: T[], instante: (item: T) => string): { dia: string; items: T[] }[] {
  const grupos: { dia: string; items: T[] }[] = [];
  for (const item of lista) {
    const dia = diaLocal(instante(item));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.items.push(item);
    else grupos.push({ dia, items: [item] });
  }
  return grupos;
}

// "14:32"
export function horaLocal(instante: string): string {
  return new Date(instante).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
}
