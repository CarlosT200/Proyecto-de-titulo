import { QrCode } from "@phosphor-icons/react";
import { HistorialAccesos } from "../../components/HistorialAccesos";

export default function AdminAccesos() {
  return <HistorialAccesos icono={QrCode} titulo="Control de acceso" subtitulo="Historial de validaciones de códigos QR." mostrarValidador />;
}
