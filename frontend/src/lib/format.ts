// Los campos "fecha" (Reserva, Multa, Visita) son fechas puras (@db.Date) sin componente horario.
// Se leen los digitos directamente desde el ISO recibido para evitar que la conversion a
// la zona horaria local del navegador retroceda un dia (p. ej. "2026-09-21T00:00:00.000Z" en UTC-3
// se transformaria en 20 de septiembre si se pasara por new Date(...).toLocaleDateString()).
// Dia de un instante (createdAt, apeladaEn...) en la hora local: a diferencia de formatFecha, que lee
// los digitos tal cual, aqui "2026-10-09T01:30Z" es el 8 de octubre en Chile (UTC-3).
export function formatDia(instante: string | Date): string {
  const d = typeof instante === "string" ? new Date(instante) : instante;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
}

export function formatFecha(fecha: string | Date): string {
  if (typeof fecha === "string") {
    const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, anio, mes, dia] = match;
      return `${dia}-${mes}-${anio}`;
    }
  }
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatFechaHora(fecha: string | Date): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  // hour12: false fuerza formato 24 horas (ej. 18:00) sin importar la
  // configuracion regional del dispositivo -- algunos celulares, segun su
  // ajuste de sistema, mostraban 12 horas sin AM/PM (ej. "06:00" para las
  // 18:00), lo que se prestaba para confusion.
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Una reserva confirmada cuyo horario ya termino se muestra como "Finalizada": antes seguia
// diciendo "Confirmada" y ofrecia "Cancelar" para reservas de hace semanas.
export function reservaFinalizada(r: { fecha: string; horaFin: string; estado: string }): boolean {
  if (r.estado !== "CONFIRMADA") return false;
  const ahora = new Date();
  const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  return `${r.fecha.slice(0, 10)} ${r.horaFin}` <= `${hoyLocal()} ${hora}`;
}

export function formatMonto(monto: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
    monto
  );
}

// Fecha de hoy (YYYY-MM-DD) segun el reloj del dispositivo. new Date().toISOString() entrega
// la fecha en UTC: en Chile (UTC-3/-4) desde las ~20:00 ya marca "manana" y el selector de
// fecha no dejaba reservar para hoy en la noche.
export function hoyLocal(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
