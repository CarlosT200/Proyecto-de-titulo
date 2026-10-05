import { ClockCounterClockwise } from "@phosphor-icons/react";
import { HistorialAccesos } from "../../components/HistorialAccesos";

export default function ConserjeAccesos() {
  return (
    <HistorialAccesos
      icono={ClockCounterClockwise}
      titulo="Historial de accesos"
      subtitulo="Registros de validaciones QR realizadas."
      mostrarValidador={false}
    />
  );
}
