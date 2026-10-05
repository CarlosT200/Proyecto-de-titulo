import { useState } from "react";
import { motion } from "framer-motion";
import { ClipboardText } from "@phosphor-icons/react";
import { auditoriaApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Card, EmptyState, Label, PageHeader, Select, Spinner, staggerFade } from "../../components/ui";
import { formatFechaHora } from "../../lib/format";
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

const ACCION_LABEL: Record<AccionAuditoria, string> = {
  CREAR: "Creación",
  ACTUALIZAR: "Cambio",
  ELIMINAR: "Eliminación",
  CANCELAR: "Cancelación",
};

const ACCION_TONO: Record<AccionAuditoria, "green" | "blue" | "red" | "amber"> = {
  CREAR: "green",
  ACTUALIZAR: "blue",
  ELIMINAR: "red",
  CANCELAR: "amber",
};

const ROL_LABEL: Record<string, string> = { ADMIN: "Administración", CONSERJE: "Conserjería", RESIDENTE: "Residente" };

// RNF-06: quien hizo que y cuando. Lo eliminado tambien queda aqui, aunque ya no exista.
export default function AdminAuditoria() {
  const [entidad, setEntidad] = useState("");
  const { data, cargando, error } = useAsync(() => auditoriaApi.listar(entidad || undefined), [entidad]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardText}
        title="Registro de actividad"
        subtitle="Quién hizo qué y cuándo: acciones de administración y conserjería."
      />

      <div className="w-full sm:max-w-xs">
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

      <Card>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={ClipboardText} title="Aún no hay actividad registrada" description="Aquí aparecerán los cambios que haga el equipo." />
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {data.map((r, i) => (
              <motion.div
                key={r.id}
                {...staggerFade(i)}
                className="flex items-start justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-100">{r.descripcion}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {r.usuario ? `${r.usuario.nombre} ${r.usuario.apellido} (${ROL_LABEL[r.usuario.rol] ?? r.usuario.rol})` : "Cuenta eliminada"} ·{" "}
                    {formatFechaHora(r.createdAt)}
                  </p>
                </div>
                <Badge tone={ACCION_TONO[r.accion]}>{ACCION_LABEL[r.accion]}</Badge>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
