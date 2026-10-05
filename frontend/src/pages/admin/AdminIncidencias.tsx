import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Wrench } from "@phosphor-icons/react";
import { incidenciasApi, usuariosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { useFiltroUrl } from "../../hooks/useFiltroUrl";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Label,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  staggerFade,
  Textarea,
} from "../../components/ui";
import { HistorialIncidencia } from "../../components/Incidencias";
import { formatFechaHora } from "../../lib/format";
import { ESTADO_INCIDENCIA_LABEL, ESTADO_INCIDENCIA_TONO, PRIORIDAD_LABEL, PRIORIDAD_TONO } from "../../lib/badges";
import { CATEGORIAS_INCIDENCIA, etiquetaCategoria, normalizarCategoria } from "../../lib/categorias";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import type { EstadoIncidencia, PrioridadIncidencia } from "../../types";

const ESTADOS: EstadoIncidencia[] = ["REPORTADA", "EN_REVISION", "EN_PROCESO", "RESUELTA"];
const PRIORIDADES: PrioridadIncidencia[] = ["BAJA", "MEDIA", "ALTA"];
// "ABIERTAS" agrupa todo lo que no esta resuelto (lo usa el panel en "Requiere atención").
const FILTROS_ESTADO = ["ABIERTAS", ...ESTADOS] as const;

export default function AdminIncidencias() {
  const { data, cargando, error, recargar } = useAsync(() => incidenciasApi.listarTodas(), []);
  const [params, setParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useFiltroUrl("estado", FILTROS_ESTADO);
  const [filtroPrioridad, setFiltroPrioridad] = useFiltroUrl("prioridad", PRIORIDADES);
  const seleccionadaId = params.get("ver");

  function abrir(id: string | null) {
    setParams(
      (actuales) => {
        const siguientes = new URLSearchParams(actuales);
        if (id) siguientes.set("ver", id);
        else siguientes.delete("ver");
        return siguientes;
      },
      { replace: true }
    );
  }

  const filtradas = (data ?? []).filter((inc) => {
    const texto = `${inc.titulo} ${inc.ubicacion} ${inc.usuario?.nombre ?? ""} ${inc.usuario?.apellido ?? ""} ${etiquetaCategoria(inc.categoria) ?? ""}`.toLowerCase();
    const coincideTexto = !busqueda || texto.includes(busqueda.toLowerCase());
    const coincideEstado =
      !filtroEstado || (filtroEstado === "ABIERTAS" ? inc.estado !== "RESUELTA" : inc.estado === filtroEstado);
    const coincidePrioridad = !filtroPrioridad || inc.prioridad === filtroPrioridad;
    return coincideTexto && coincideEstado && coincidePrioridad;
  });

  const hayFiltros = Boolean(busqueda || filtroEstado || filtroPrioridad);

  return (
    <div className="space-y-6">
      <PageHeader icon={Wrench} title="Incidencias" subtitle="Gestión, priorización e historial." />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por título, ubicación, categoría o residente..."
          className="w-full sm:max-w-xs"
        />
        <Select
          aria-label="Filtrar por estado"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
          className="w-full sm:w-52"
        >
          <option value="">Todos los estados</option>
          <option value="ABIERTAS">Abiertas (sin resolver)</option>
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {ESTADO_INCIDENCIA_LABEL[estado]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por prioridad"
          value={filtroPrioridad}
          onChange={(e) => setFiltroPrioridad(e.target.value as typeof filtroPrioridad)}
          className="w-full sm:w-48"
        >
          <option value="">Todas las prioridades</option>
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>
              Prioridad {PRIORIDAD_LABEL[p].toLowerCase()}
            </option>
          ))}
        </Select>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setFiltroEstado("");
              setFiltroPrioridad("");
            }}
            className="text-xs text-brand-600 hover:underline max-sm:min-h-11 dark:text-brand-400"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <Card>
        {cargando && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState title="Aún no hay incidencias reportadas" />
        ) : !filtradas.length ? (
          <EmptyState title="Sin resultados" description="Ninguna incidencia coincide con los filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla-movil w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-700/60 dark:text-slate-500">
                <tr>
                  <th className="px-5 py-3">Título</th>
                  <th className="px-5 py-3">Categoría</th>
                  <th className="px-5 py-3">Residente</th>
                  <th className="px-5 py-3">Prioridad</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Reportada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {filtradas.map((inc, i) => (
                  <motion.tr
                    key={inc.id}
                    {...staggerFade(i)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Abrir la incidencia ${inc.titulo}`}
                    className="cursor-pointer transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:hover:bg-slate-700/60 dark:focus:bg-slate-700/60"
                    onClick={() => abrir(inc.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        abrir(inc.id);
                      }
                    }}
                  >
                    <td data-label="Título" className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">
                      <div>
                        {inc.titulo}
                        <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{inc.ubicacion}</span>
                      </div>
                    </td>
                    <td data-label="Categoría" className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {etiquetaCategoria(inc.categoria) ?? "—"}
                    </td>
                    <td data-label="Residente" className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {inc.usuario ? `${inc.usuario.nombre} ${inc.usuario.apellido}` : "—"}
                    </td>
                    <td data-label="Prioridad" className="px-5 py-3">
                      {inc.prioridad ? <Badge tone={PRIORIDAD_TONO[inc.prioridad]}>{PRIORIDAD_LABEL[inc.prioridad]}</Badge> : "—"}
                    </td>
                    <td data-label="Estado" className="px-5 py-3">
                      <Badge tone={ESTADO_INCIDENCIA_TONO[inc.estado]}>{ESTADO_INCIDENCIA_LABEL[inc.estado]}</Badge>
                    </td>
                    <td data-label="Reportada" className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatFechaHora(inc.createdAt)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {seleccionadaId && <DetalleIncidencia id={seleccionadaId} onClose={() => abrir(null)} onActualizada={recargar} />}
    </div>
  );
}

function DetalleIncidencia({ id, onClose, onActualizada }: { id: string; onClose: () => void; onActualizada: () => void }) {
  const toast = useToast();
  const { data: incidencia, cargando, error: errorCarga, setData } = useAsync(() => incidenciasApi.obtener(id), [id]);
  const { data: admins } = useAsync(() => usuariosApi.listar({ rol: "ADMIN", activo: true }), []);
  const [estado, setEstado] = useState<EstadoIncidencia | "">("");
  const [prioridad, setPrioridad] = useState<PrioridadIncidencia | "">("");
  const [categoria, setCategoria] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Valores con los que se abrio el formulario: solo se envia lo que cambio.
  const original = incidencia
    ? {
        estado: incidencia.estado,
        prioridad: (incidencia.prioridad ?? "") as PrioridadIncidencia | "",
        categoria: normalizarCategoria(incidencia.categoria) ?? "",
        responsableId: incidencia.responsableId ?? "",
      }
    : null;

  useEffect(() => {
    if (!original) return;
    setEstado(original.estado);
    setPrioridad(original.prioridad);
    setCategoria(original.categoria);
    setResponsableId(original.responsableId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidencia?.id, incidencia?.updatedAt]);

  const cambios = original
    ? {
        estado: estado && estado !== original.estado ? estado : undefined,
        prioridad: prioridad && prioridad !== original.prioridad ? prioridad : undefined,
        categoria: categoria && categoria !== original.categoria ? categoria : undefined,
        responsableId: responsableId !== original.responsableId ? responsableId || null : undefined,
        observacion: observacion.trim() || undefined,
      }
    : null;
  const hayCambios = Boolean(cambios && Object.values(cambios).some((v) => v !== undefined));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cambios || !hayCambios) return;
    setError(null);
    setGuardando(true);
    try {
      await incidenciasApi.actualizar(id, cambios);
      setObservacion("");
      setData(await incidenciasApi.obtener(id));
      toast.success(cambios.estado || cambios.observacion ? "Incidencia actualizada. El residente recibió un aviso." : "Incidencia actualizada.");
      onActualizada();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  const sugerencia = incidencia?.sugerenciaIA;
  const sugerenciaCategoria = normalizarCategoria(sugerencia?.categoria);
  const sugerenciaDistinta = Boolean(
    sugerencia && ((sugerenciaCategoria && sugerenciaCategoria !== categoria) || sugerencia.prioridad !== prioridad)
  );

  return (
    <Modal open onClose={onClose} title={incidencia?.titulo ?? "Incidencia"}>
      {cargando && !incidencia ? (
        <Spinner />
      ) : errorCarga || !incidencia ? (
        <Alert tone="red">{errorCarga ?? "No se pudo cargar la incidencia."}</Alert>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-300">{incidencia.descripcion}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Ubicación: {incidencia.ubicacion} · Reportada por {incidencia.usuario?.nombre} {incidencia.usuario?.apellido} el{" "}
              {formatFechaHora(incidencia.createdAt)}
            </p>
            {incidencia.fotoUrl && (
              <img
                src={incidencia.fotoUrl}
                alt="Foto de la incidencia"
                className="mt-3 max-h-64 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-slate-700 dark:bg-slate-900/40"
              />
            )}
          </div>

          {sugerencia && (
            <Alert tone="amber">
              <p className="font-semibold">Clasificación automática</p>
              <p>
                Categoría: {etiquetaCategoria(sugerencia.categoria)} · Prioridad: {PRIORIDAD_LABEL[sugerencia.prioridad] ?? sugerencia.prioridad}
                {sugerencia.ubicacionDetectada ? ` · Ubicación: ${sugerencia.ubicacionDetectada}` : ""} · Confianza: {sugerencia.confianza}
              </p>
              <p className="mt-1 text-xs">Es una propuesta basada en palabras clave: revísala y corrígela si hace falta.</p>
              {sugerenciaDistinta && (
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold underline underline-offset-2 max-sm:min-h-11"
                  onClick={() => {
                    if (sugerenciaCategoria) setCategoria(sugerenciaCategoria);
                    setPrioridad(sugerencia.prioridad);
                  }}
                >
                  Usar esta clasificación en el formulario
                </button>
              )}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="campo-incidencia-estado">Estado</Label>
                <Select id="campo-incidencia-estado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoIncidencia)}>
                  {ESTADOS.map((e2) => (
                    <option key={e2} value={e2}>
                      {ESTADO_INCIDENCIA_LABEL[e2]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="campo-incidencia-prioridad">Prioridad</Label>
                <Select
                  id="campo-incidencia-prioridad"
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value as PrioridadIncidencia)}
                >
                  {!original?.prioridad && <option value="">Sin definir</option>}
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORIDAD_LABEL[p]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="campo-incidencia-categoria">Categoría</Label>
                <Select id="campo-incidencia-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  {!original?.categoria && (
                    <option value="">{incidencia.categoria ? `${incidencia.categoria} (sin clasificar)` : "Sin categoría"}</option>
                  )}
                  {CATEGORIAS_INCIDENCIA.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.etiqueta}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="campo-incidencia-responsable">Responsable</Label>
                <Select id="campo-incidencia-responsable" value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {admins?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} {a.apellido}
                    </option>
                  ))}
                  {incidencia.responsable && !admins?.some((a) => a.id === incidencia.responsable!.id) && (
                    <option value={incidencia.responsable.id}>
                      {incidencia.responsable.nombre} {incidencia.responsable.apellido}
                    </option>
                  )}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="campo-incidencia-comentario">Comentario para el residente (opcional)</Label>
              <Textarea
                id="campo-incidencia-comentario"
                rows={2}
                maxLength={1000}
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Ej: El gasfíter viene mañana a las 10:00."
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Queda en el historial y el residente recibe un aviso con el texto.
              </p>
            </div>
            {error && <Alert tone="red">{error}</Alert>}
            <Button type="submit" className="w-full" loading={guardando} disabled={!hayCambios}>
              Guardar cambios
            </Button>
          </form>

          <div className="border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Historial</p>
            <HistorialIncidencia historial={incidencia.historial ?? []} />
          </div>
        </div>
      )}
    </Modal>
  );
}

