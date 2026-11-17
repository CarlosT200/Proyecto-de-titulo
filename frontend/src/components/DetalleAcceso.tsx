// Forma compartida con el "detalle" que devuelve el backend tanto al validar
// un QR en vivo (qrApi.validar) como en el historial de accesos
// (qrApi.accesos) -- un solo componente de render para los dos contextos,
// en vez de reimplementar el mismo armado de texto "Torre X depto" / "Va a
// ... · Autoriza ..." en cada pagina que muestra un resultado de acceso.
export type DepartamentoInfo = { numero: string; torre: { nombre: string } | null } | null;
export type PersonaInfo = { id: string; nombre: string; apellido: string; departamento: DepartamentoInfo };
export type DetalleAccesoData =
  | { residente: PersonaInfo }
  | { visita: { nombreVisita: string; residente: PersonaInfo | null } }
  | null
  | undefined;

function formatUnidad(departamento: DepartamentoInfo): string | null {
  if (!departamento) return null;
  return `${departamento.torre?.nombre ?? ""} ${departamento.numero}`.trim();
}

export function DetalleAcceso({ detalle, className }: { detalle: DetalleAccesoData; className?: string }) {
  if (!detalle) return null;

  if ("residente" in detalle) {
    const { residente } = detalle;
    return (
      <div className={className}>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {residente.nombre} {residente.apellido}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {formatUnidad(residente.departamento) || "Sin unidad asignada"}
        </p>
      </div>
    );
  }

  const { visita } = detalle;
  return (
    <div className={className}>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Visita: {visita.nombreVisita}</p>
      {visita.residente && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Va a {formatUnidad(visita.residente.departamento) || "unidad no asignada"} · Autoriza {visita.residente.nombre}{" "}
          {visita.residente.apellido}
        </p>
      )}
    </div>
  );
}
