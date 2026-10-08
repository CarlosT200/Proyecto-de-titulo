import { Badge } from "./ui";
import { formatFecha } from "../lib/format";
import type { Multa } from "../types";

// La respuesta de la administracion a una apelacion, con su decision. La ven el residente y la
// administracion; no se muestra mientras la multa sigue esperando respuesta.
export function RespuestaApelacion({ multa, className }: { multa: Multa; className?: string }) {
  if (!multa.respuesta) return null;
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">Respuesta de la administración{multa.respondidaEn ? ` (${formatFecha(multa.respondidaEn)})` : ""}</p>
        {multa.apelacionAceptada !== null && multa.apelacionAceptada !== undefined && (
          <Badge tone={multa.apelacionAceptada ? "green" : "red"}>{multa.apelacionAceptada ? "Apelación aceptada" : "Apelación rechazada"}</Badge>
        )}
      </div>
      <p className="mt-0.5 break-words">{multa.respuesta}</p>
    </div>
  );
}
