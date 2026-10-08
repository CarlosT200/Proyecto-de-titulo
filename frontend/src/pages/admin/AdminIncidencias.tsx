import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Wrench } from "@phosphor-icons/react";
import { incidenciasApi, usuariosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { useFiltroUrl } from "../../hooks/useFiltroUrl";
import { useEsCelular } from "../../hooks/useEsCelular";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Label,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";
import { BadgeEstadoIncidencia, BadgePrioridadIncidencia, HistorialIncidencia } from "../../components/Incidencias";
import { CeldaResumen } from "../../components/CeldaResumen";
import { formatFechaHora } from "../../lib/format";
import { ESTADO_INCIDENCIA_LABEL, PRIORIDAD_LABEL } from "../../lib/badges";
import { CATEGORIAS_INCIDENCIA, etiquetaCategoria, normalizarCategoria } from "../../lib/categorias";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import type { EstadoIncidencia, Incidencia, PrioridadIncidencia } from "../../types";

const ESTADOS: EstadoIncidencia[] = ["REPORTADA", "EN_REVISION", "EN_PROCESO", "RESUELTA"];
const PRIORIDADES: PrioridadIncidencia[] = ["BAJA", "MEDIA", "ALTA"];
// "ABIERTAS" agrupa todo lo que no esta resuelto (lo usa el panel en "Requiere atención").
const FILTROS_ESTADO = ["ABIERTAS", ...ESTADOS] as const;

const ORDEN_PRIORIDAD: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
const ORDEN_ESTADO: Record<EstadoIncidencia, number> = { REPORTADA: 0, EN_REVISION: 1, EN_PROCESO: 2, RESUELTA: 3 };

// Lo abierto primero y, dentro de eso, lo mas urgente: prioridad alta antes que media y baja, y a igual
// prioridad lo que esta mas atrasado en su gestion y lleva mas tiempo esperando. Lo resuelto va al
// final, de la mas reciente a la mas antigua.
function ordenarPorUrgencia(lista: Incidencia[]): Incidencia[] {
  const tiempo = (i: Incidencia) => new Date(i.createdAt).getTime();
  return [...lista].sort((a, b) => {
    const aResuelta = a.estado === "RESUELTA";
    const bResuelta = b.estado === "RESUELTA";
    if (aResuelta !== bResuelta) return aResuelta ? 1 : -1;
    if (aResuelta) return tiempo(b) - tiempo(a);
    const pa = ORDEN_PRIORIDAD[a.prioridad ?? ""] ?? 3;
    const pb = ORDEN_PRIORIDAD[b.prioridad ?? ""] ?? 3;
    if (pa !== pb) return pa - pb;
    if (a.estado !== b.estado) return ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado];
    return tiempo(a) - tiempo(b);
  });
}

type FiltroResumen = { estado: (typeof FILTROS_ESTADO)[number] | ""; prioridad: PrioridadIncidencia | "" };

// Lo que hay que atender al abrir la pantalla; cada cifra aplica ese filtro (y al tocarla otra vez lo
// quita). Se calcula con todas las incidencias, no con el filtro que este puesto.
function ResumenIncidencias({
  incidencias,
  filtro,
  onFiltrar,
}: {
  incidencias: Incidencia[];
  filtro: FiltroResumen;
  onFiltrar: (f: FiltroResumen) => void;
}) {
  const abiertas = incidencias.filter((i) => i.estado !== "RESUELTA");
  const urgentes = abiertas.filter((i) => i.prioridad === "ALTA").length;
  const sinRevisar = incidencias.filter((i) => i.estado === "REPORTADA").length;
  const celdas: { clave: string; titulo: string; valor: number; detalle: string; alerta?: "red" | "amber"; aplica: FiltroResumen }[] = [
    { clave: "urgentes", titulo: "Urgentes", valor: urgentes, detalle: "prioridad alta sin resolver", alerta: "red", aplica: { estado: "ABIERTAS", prioridad: "ALTA" } },
    { clave: "sin-revisar", titulo: "Sin revisar", valor: sinRevisar, detalle: "recién reportadas", alerta: "amber", aplica: { estado: "REPORTADA", prioridad: "" } },
    { clave: "abiertas", titulo: "Abiertas", valor: abiertas.length, detalle: "sin resolver", aplica: { estado: "ABIERTAS", prioridad: "" } },
  ];
  return (
    <Card plana className="overflow-hidden">
      <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-700/60">
        {celdas.map((c) => {
          const activa = filtro.estado === c.aplica.estado && filtro.prioridad === c.aplica.prioridad;
          return (
            <CeldaResumen
              key={c.clave}
              titulo={c.titulo}
              valor={c.valor}
              detalle={c.detalle}
              alerta={c.alerta}
              activa={activa}
              onToggle={() => onFiltrar(activa ? { estado: "", prioridad: "" } : c.aplica)}
            />
          );
        })}
      </div>
    </Card>
  );
}

export default function AdminIncidencias() {
  const { data, cargando, error, recargar } = useAsync(() => incidenciasApi.listarTodas(), []);
  const [params, setParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useFiltroUrl("estado", FILTROS_ESTADO);
  const [filtroPrioridad, setFiltroPrioridad] = useFiltroUrl("prioridad", PRIORIDADES);
  const seleccionadaId = params.get("ver");
  const esCelular = useEsCelular();

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

  // Los dos filtros se cambian en una sola actualizacion de la direccion: dos cambios seguidos (uno por
  // filtro) se pisan entre si y solo quedaba el ultimo.
  function aplicarFiltro(f: FiltroResumen) {
    setParams(
      (actuales) => {
        const siguientes = new URLSearchParams(actuales);
        if (f.estado) siguientes.set("estado", f.estado);
        else siguientes.delete("estado");
        if (f.prioridad) siguientes.set("prioridad", f.prioridad);
        else siguientes.delete("prioridad");
        return siguientes;
      },
      { replace: true }
    );
  }

  const filtradas = ordenarPorUrgencia(
    (data ?? []).filter((inc) => {
      const texto = `${inc.titulo} ${inc.ubicacion} ${inc.usuario?.nombre ?? ""} ${inc.usuario?.apellido ?? ""} ${etiquetaCategoria(inc.categoria) ?? ""}`.toLowerCase();
      const coincideTexto = !busqueda || texto.includes(busqueda.toLowerCase());
      const coincideEstado =
        !filtroEstado || (filtroEstado === "ABIERTAS" ? inc.estado !== "RESUELTA" : inc.estado === filtroEstado);
      const coincidePrioridad = !filtroPrioridad || inc.prioridad === filtroPrioridad;
      return coincideTexto && coincideEstado && coincidePrioridad;
    })
  );

  const hayFiltros = Boolean(busqueda || filtroEstado || filtroPrioridad);
  const nombreDe = (inc: Incidencia) => (inc.usuario ? `${inc.usuario.nombre} ${inc.usuario.apellido}` : "—");

  return (
    <div className="space-y-6">
      <PageHeader icon={Wrench} title="Incidencias" subtitle="Gestión, priorización e historial." />

      {data && data.length > 0 && (
        <ResumenIncidencias incidencias={data} filtro={{ estado: filtroEstado, prioridad: filtroPrioridad }} onFiltrar={aplicarFiltro} />
      )}

      {/* En celular: el buscador a todo el ancho y los dos filtros lado a lado (antes eran tres filas). */}
      <div className="grid grid-cols-2 items-center gap-3 sm:flex sm:flex-wrap">
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por título, ubicación, categoría o residente..."
          className="col-span-2 w-full sm:max-w-xs"
        />
        <Select
          aria-label="Filtrar por estado"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
          className="w-full sm:w-52"
        >
          <option value="">{esCelular ? "Estado" : "Todos los estados"}</option>
          <option value="ABIERTAS">{esCelular ? "Abiertas" : "Abiertas (sin resolver)"}</option>
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
          <option value="">{esCelular ? "Prioridad" : "Todas las prioridades"}</option>
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>
              {esCelular ? PRIORIDAD_LABEL[p] : `Prioridad ${PRIORIDAD_LABEL[p].toLowerCase()}`}
            </option>
          ))}
        </Select>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              aplicarFiltro({ estado: "", prioridad: "" });
            }}
            className="col-span-2 inline-flex items-center justify-center rounded-lg text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:min-h-11 dark:text-brand-400"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <Card plana>
        {cargando && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState title="Aún no hay incidencias reportadas" />
        ) : !filtradas.length ? (
          <EmptyState title="Sin resultados" description="Ninguna incidencia coincide con los filtros." />
        ) : (
          <>
            <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              Ordenadas por urgencia: primero la prioridad alta y lo que lleva más tiempo esperando.
            </p>

            {/* Celular: una tarjeta compacta por incidencia (titulo, insignias y datos), toda tocable.
                Desde 640 px: tabla. */}
            <ul className="divide-y divide-slate-100 sm:hidden dark:divide-slate-700/60">
              {filtradas.map((inc) => (
                <li key={inc.id}>
                  <button
                    type="button"
                    onClick={() => abrir(inc.id)}
                    aria-label={`Abrir la incidencia ${inc.titulo}`}
                    className="block w-full space-y-1.5 px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:hover:bg-slate-700/60"
                  >
                    <span className="block break-words font-medium text-slate-900 dark:text-slate-100">{inc.titulo}</span>
                    <span className="flex flex-wrap gap-1.5">
                      <BadgePrioridadIncidencia prioridad={inc.prioridad} largo />
                      <BadgeEstadoIncidencia estado={inc.estado} />
                    </span>
                    <span className="block break-words text-sm text-slate-600 dark:text-slate-300">{inc.ubicacion}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {etiquetaCategoria(inc.categoria) ?? "Sin categoría"} · {nombreDe(inc)} · {formatFechaHora(inc.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-3">Título</th>
                    <th scope="col" className="px-5 py-3">Categoría</th>
                    <th scope="col" className="px-5 py-3">Residente</th>
                    <th scope="col" className="px-5 py-3">Prioridad</th>
                    <th scope="col" className="px-5 py-3">Estado</th>
                    <th scope="col" className="px-5 py-3">Reportada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filtradas.map((inc) => (
                    <tr
                      key={inc.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Abrir la incidencia ${inc.titulo}`}
                      className="cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:hover:bg-slate-700/60 dark:focus-visible:bg-slate-700/60"
                      onClick={() => abrir(inc.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          abrir(inc.id);
                        }
                      }}
                    >
                      <td className="max-w-xs px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <span className="block break-words">{inc.titulo}</span>
                        <span className="block break-words text-xs font-normal text-slate-500 dark:text-slate-400">{inc.ubicacion}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{etiquetaCategoria(inc.categoria) ?? "Sin categoría"}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{nombreDe(inc)}</td>
                      <td className="px-5 py-3">
                        <BadgePrioridadIncidencia prioridad={inc.prioridad} />
                      </td>
                      <td className="px-5 py-3">
                        <BadgeEstadoIncidencia estado={inc.estado} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-600 dark:text-slate-300">{formatFechaHora(inc.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
            <div className="grid grid-cols-2 gap-3">
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
              <div className="col-span-2 sm:col-span-1">
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
              <div className="col-span-2 sm:col-span-1">
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
            {/* El boton queda pegado abajo mientras se edita el formulario: antes habia que bajar toda la
                ventana (alerta, cuatro selectores, comentario) para guardar. */}
            <div className="sticky bottom-0 -mx-5 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-700/60 dark:bg-slate-800">
              <Button type="submit" className="w-full" loading={guardando} disabled={!hayCambios}>
                Guardar cambios
              </Button>
            </div>
          </form>

          <div className="border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Historial</h4>
            <HistorialIncidencia historial={incidencia.historial ?? []} />
          </div>
        </div>
      )}
    </Modal>
  );
}

