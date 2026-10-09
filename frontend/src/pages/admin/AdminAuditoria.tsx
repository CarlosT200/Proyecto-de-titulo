import { useState } from "react";
import clsx from "clsx";
import { ClipboardText, PencilSimple, Plus, Prohibit, Trash } from "@phosphor-icons/react";
import { auditoriaApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Card, EmptyState, Label, PageHeader, SearchInput, Select, Spinner } from "../../components/ui";
import { agruparPorDia, etiquetaDia, horaLocal } from "../../lib/dias";
import type { AccionAuditoria } from "../../types";

const ENTIDADES: { valor: string; etiqueta: string }[] = [
  { valor: "Comunicado", etiqueta: "Comunicados" },
  { valor: "Documento", etiqueta: "Documentos" },
  { valor: "Multa", etiqueta: "Multas" },
  { valor: "Incidencia", etiqueta: "Incidencias" },
  { valor: "Reserva", etiqueta: "Reservas" },
  { valor: "Usuario", etiqueta: "Cuentas de usuario" },
  { valor: "Condominio", etiqueta: "Estructura del condominio" },
  { valor: "Encomienda", etiqueta: "Encomiendas" },
  { valor: "AlertaSos", etiqueta: "Alertas SOS" },
  { valor: "GastoComun", etiqueta: "Gastos comunes" },
];

// Cada accion con su icono y su color (el color acompaña a la palabra, no la reemplaza).
const ACCION: Record<AccionAuditoria, { etiqueta: string; icono: typeof Plus; clases: string }> = {
  CREAR: { etiqueta: "Creación", icono: Plus, clases: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  ACTUALIZAR: { etiqueta: "Cambio", icono: PencilSimple, clases: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" },
  ELIMINAR: { etiqueta: "Eliminación", icono: Trash, clases: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  CANCELAR: { etiqueta: "Cancelación", icono: Prohibit, clases: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200" },
};

const ROL_LABEL: Record<string, string> = { ADMIN: "Administración", CONSERJE: "Conserjería", RESIDENTE: "Residente" };

// RNF-06: quien hizo que y cuando. Lo eliminado tambien queda aqui, aunque ya no exista.
export default function AdminAuditoria() {
  const [entidad, setEntidad] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const { data, cargando, error } = useAsync(() => auditoriaApi.listar(entidad || undefined), [entidad]);

  const filtrados = (data ?? []).filter((r) => {
    if (!busqueda) return true;
    const quien = r.usuario ? `${r.usuario.nombre} ${r.usuario.apellido}` : "";
    return `${r.descripcion} ${quien}`.toLowerCase().includes(busqueda.toLowerCase());
  });
  const grupos = agruparPorDia(filtrados, (r) => r.createdAt);

  return (
    <div className="space-y-6">
      <PageHeader icon={ClipboardText} title="Registro de actividad" subtitle="Quién hizo qué y cuándo: acciones de administración y conserjería." />

      <div className="grid grid-cols-1 items-end gap-3 sm:flex sm:flex-wrap">
        <div className="sm:w-72">
          <Label htmlFor="campo-auditoria-entidad">Mostrar</Label>
          <Select id="campo-auditoria-entidad" value={entidad} onChange={(e) => setEntidad(e.target.value)}>
            <option value="">Toda la actividad</option>
            {ENTIDADES.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </Select>
        </div>
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar en la actividad..." className="w-full sm:max-w-xs" />
      </div>

      <Card plana className="overflow-hidden">
        {cargando && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={ClipboardText} title="Aún no hay actividad registrada" description="Aquí aparecerán los cambios que haga el equipo." />
        ) : !filtrados.length ? (
          <EmptyState title="Sin resultados" description="Nada en la actividad coincide con la búsqueda." />
        ) : (
          grupos.map((g) => (
            <section key={g.dia} aria-labelledby={`actividad-${g.dia}`}>
              <h2
                id={`actividad-${g.dia}`}
                className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300"
              >
                {etiquetaDia(g.dia)} · {g.items.length}
              </h2>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {g.items.map((r) => {
                  const accion = ACCION[r.accion];
                  const Icono = accion.icono;
                  return (
                    <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                      <span className={clsx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", accion.clases)}>
                        <Icono size={16} weight="bold" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 break-words text-sm text-slate-900 dark:text-slate-100">{r.descripcion}</p>
                          <span className="shrink-0 text-sm tabular-nums text-slate-600 dark:text-slate-300">{horaLocal(r.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                          <span className="font-medium">{accion.etiqueta}</span>
                          {" · "}
                          {r.usuario ? `${r.usuario.nombre} ${r.usuario.apellido} (${ROL_LABEL[r.usuario.rol] ?? r.usuario.rol})` : "Cuenta eliminada"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </Card>
    </div>
  );
}
