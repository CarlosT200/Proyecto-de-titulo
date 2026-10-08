import clsx from "clsx";
import { Badge } from "./ui";
import { usePulsoAlCambiar } from "../hooks/usePulsoAlCambiar";
import { ESTADO_RESERVA_LABEL, ESTADO_RESERVA_TONO } from "../lib/badges";
import type { EstadoReservaVisible } from "../lib/reservas";

// Cuando el estado cambia (se cancela) la insignia entra con un movimiento corto para que se note;
// al cargar la pagina no se mueve.
export function BadgeEstadoReserva({ estado }: { estado: EstadoReservaVisible }) {
  const pulso = usePulsoAlCambiar(estado);
  return (
    <span key={pulso} className={clsx("inline-flex", pulso > 0 && "animate-aparece")}>
      <Badge tone={ESTADO_RESERVA_TONO[estado]}>{ESTADO_RESERVA_LABEL[estado]}</Badge>
    </span>
  );
}
