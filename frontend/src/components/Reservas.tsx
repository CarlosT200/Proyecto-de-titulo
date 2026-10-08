import { Badge } from "./ui";
import { ESTADO_RESERVA_LABEL, ESTADO_RESERVA_TONO } from "../lib/badges";
import type { EstadoReservaVisible } from "../lib/reservas";

export function BadgeEstadoReserva({ estado }: { estado: EstadoReservaVisible }) {
  return <Badge tone={ESTADO_RESERVA_TONO[estado]}>{ESTADO_RESERVA_LABEL[estado]}</Badge>;
}
