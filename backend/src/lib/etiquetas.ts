import { EstadoIncidencia, EstadoMulta } from "@prisma/client";

// Nombres legibles de los estados, iguales a los que muestra el frontend (lib/badges.ts).
// Las notificaciones (y los push que llegan al celular) mostraban el valor crudo del enum,
// por ejemplo "cambio de estado a EN_REVISION".
export const ESTADO_INCIDENCIA_LABEL: Record<EstadoIncidencia, string> = {
  REPORTADA: "Reportada",
  EN_REVISION: "En revisión",
  EN_PROCESO: "En proceso",
  RESUELTA: "Resuelta",
};

export const ESTADO_MULTA_LABEL: Record<EstadoMulta, string> = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  APELADA: "Apelada",
  ANULADA: "Anulada",
};
