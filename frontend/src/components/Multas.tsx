import clsx from "clsx";
import { Badge } from "./ui";
import { usePulsoAlCambiar } from "../hooks/usePulsoAlCambiar";
import { ESTADO_MULTA_LABEL, ESTADO_MULTA_TONO } from "../lib/badges";
import type { EstadoMulta } from "../types";

// Insignia del estado de una multa. Cuando el estado cambia (la administracion la marca como pagada,
// el residente la apela) la insignia entra con un movimiento corto para que se note el cambio; al
// cargar la pagina no se mueve.
export function BadgeEstadoMulta({ estado }: { estado: EstadoMulta }) {
  const pulso = usePulsoAlCambiar(estado);
  return (
    <span key={pulso} className={clsx("inline-flex", pulso > 0 && "animate-aparece")}>
      <Badge tone={ESTADO_MULTA_TONO[estado]}>{ESTADO_MULTA_LABEL[estado]}</Badge>
    </span>
  );
}
