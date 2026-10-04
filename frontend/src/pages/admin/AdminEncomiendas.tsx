import { useState } from "react";
import { motion } from "framer-motion";
import { Package } from "@phosphor-icons/react";
import { encomiendasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Card, EmptyState, Input, Label, PageHeader, SearchInput, Select, Spinner, staggerFade } from "../../components/ui";
import { formatFechaHora } from "../../lib/format";
import { fechaEnRango } from "../../lib/filters";
import { ESTADO_ENCOMIENDA_LABEL, ESTADO_ENCOMIENDA_TONO } from "../../lib/badges";
import type { EstadoEncomienda } from "../../types";

const ESTADOS: EstadoEncomienda[] = ["NOTIFICADA", "RETIRADA"];

export default function AdminEncomiendas() {
  const { data, cargando, error } = useAsync(() => encomiendasApi.listarTodas(), []);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoEncomienda | "">("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const filtradas = (data ?? []).filter((enc) => {
    const texto = `${enc.usuario?.nombre ?? ""} ${enc.usuario?.apellido ?? ""} ${enc.remitente ?? ""}`.toLowerCase();
    const coincideTexto = !busqueda || texto.includes(busqueda.toLowerCase());
    const coincideEstado = !filtroEstado || enc.estado === filtroEstado;
    const coincideFecha = fechaEnRango(enc.fechaRecepcion, fechaDesde, fechaHasta);
    return coincideTexto && coincideEstado && coincideFecha;
  });

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Encomiendas" subtitle="Registro completo de encomiendas del condominio." />

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 dark:border-slate-700/60 p-5">
          <div className="w-full sm:max-w-xs">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por residente o remitente..." />
          </div>
          <div className="w-full sm:w-44">
            <Label htmlFor="campo-encomiendas-1">Estado</Label>
            <Select id="campo-encomiendas-1" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as EstadoEncomienda | "")}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {ESTADO_ENCOMIENDA_LABEL[estado]}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-40">
            <Label htmlFor="campo-encomiendas-2">Desde</Label>
            <Input id="campo-encomiendas-2" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div className="w-full sm:w-40">
            <Label htmlFor="campo-encomiendas-3">Hasta</Label>
            <Input id="campo-encomiendas-3" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
          {(busqueda || filtroEstado || fechaDesde || fechaHasta) && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setFiltroEstado("");
                setFechaDesde("");
                setFechaHasta("");
              }}
              className="text-xs text-brand-600 hover:underline max-sm:min-h-11"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState icon={Package} title="Aún no hay encomiendas registradas" />
        ) : !filtradas.length ? (
          <EmptyState title="Sin resultados" description="Ninguna encomienda coincide con los filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla-movil w-full text-left text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-700/60 text-xs uppercase text-slate-400 dark:text-slate-500">
                <tr>
                  <th className="px-5 py-3">Residente</th>
                  <th className="px-5 py-3">Remitente</th>
                  <th className="px-5 py-3">Recepción</th>
                  <th className="px-5 py-3">Retiro</th>
                  <th className="px-5 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {filtradas.map((enc, i) => (
                  <motion.tr key={enc.id} {...staggerFade(i)} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                    <td data-label="Residente" className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {enc.usuario ? `${enc.usuario.nombre} ${enc.usuario.apellido}` : "—"}
                    </td>
                    <td data-label="Remitente" className="px-5 py-3 text-slate-500 dark:text-slate-400">{enc.remitente ?? "—"}</td>
                    <td data-label="Recepción" className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatFechaHora(enc.fechaRecepcion)}</td>
                    <td data-label="Retiro" className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {enc.fechaRetiro ? formatFechaHora(enc.fechaRetiro) : "—"}
                    </td>
                    <td data-label="Estado" className="px-5 py-3">
                      <Badge tone={ESTADO_ENCOMIENDA_TONO[enc.estado]}>{ESTADO_ENCOMIENDA_LABEL[enc.estado]}</Badge>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
