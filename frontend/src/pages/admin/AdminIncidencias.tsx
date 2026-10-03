import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wrench } from "@phosphor-icons/react";
import { incidenciasApi, usuariosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  staggerFade,
  Textarea,
} from "../../components/ui";
import { formatFechaHora } from "../../lib/format";
import { ESTADO_INCIDENCIA_LABEL, ESTADO_INCIDENCIA_TONO, PRIORIDAD_LABEL, PRIORIDAD_TONO } from "../../lib/badges";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import type { EstadoIncidencia, Incidencia, PrioridadIncidencia } from "../../types";

const ESTADOS: EstadoIncidencia[] = ["REPORTADA", "EN_REVISION", "EN_PROCESO", "RESUELTA"];
const PRIORIDADES: PrioridadIncidencia[] = ["BAJA", "MEDIA", "ALTA"];

export default function AdminIncidencias() {
  const { data, cargando, error, recargar } = useAsync(() => incidenciasApi.listarTodas(), []);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoIncidencia | "">("");

  const filtradas = (data ?? []).filter((inc) => {
    const texto = `${inc.titulo} ${inc.ubicacion} ${inc.usuario?.nombre ?? ""} ${inc.usuario?.apellido ?? ""}`.toLowerCase();
    const coincideTexto = !busqueda || texto.includes(busqueda.toLowerCase());
    const coincideEstado = !filtroEstado || inc.estado === filtroEstado;
    return coincideTexto && coincideEstado;
  });

  return (
    <div className="space-y-6">
      <PageHeader icon={Wrench} title="Incidencias" subtitle="Gestión, priorización e historial (HU-10, HU-11, HU-25)." />

      <div className="flex flex-wrap gap-3">
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por título, ubicación o residente..."
          className="w-full sm:max-w-xs"
        />
        <Select
          aria-label="Filtrar por estado"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoIncidencia | "")}
          className="w-full sm:w-48"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {ESTADO_INCIDENCIA_LABEL[estado]}
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
          <EmptyState title="Aún no hay incidencias reportadas" />
        ) : !filtradas.length ? (
          <EmptyState title="Sin resultados" description="Ninguna incidencia coincide con la búsqueda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-700/60 text-xs uppercase text-slate-400 dark:text-slate-500">
                <tr>
                  <th className="px-5 py-3">Título</th>
                  <th className="px-5 py-3">Residente</th>
                  <th className="px-5 py-3">Ubicación</th>
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
                    className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60"
                    onClick={() => setSeleccionadaId(inc.id)}
                  >
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{inc.titulo}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {inc.usuario ? `${inc.usuario.nombre} ${inc.usuario.apellido}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{inc.ubicacion}</td>
                    <td className="px-5 py-3">
                      {inc.prioridad ? <Badge tone={PRIORIDAD_TONO[inc.prioridad]}>{PRIORIDAD_LABEL[inc.prioridad]}</Badge> : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={ESTADO_INCIDENCIA_TONO[inc.estado]}>{ESTADO_INCIDENCIA_LABEL[inc.estado]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatFechaHora(inc.createdAt)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {seleccionadaId && (
        <DetalleIncidencia
          id={seleccionadaId}
          onClose={() => setSeleccionadaId(null)}
          onActualizada={() => {
            recargar();
          }}
        />
      )}
    </div>
  );
}

function DetalleIncidencia({
  id,
  onClose,
  onActualizada,
}: {
  id: string;
  onClose: () => void;
  onActualizada: () => void;
}) {
  const toast = useToast();
  const { data: incidencia, cargando, recargar, setData } = useAsync(() => incidenciasApi.obtener(id), [id]);
  const { data: admins } = useAsync(() => usuariosApi.listar({ rol: "ADMIN" }), []);
  const [estado, setEstado] = useState<EstadoIncidencia | "">("");
  const [prioridad, setPrioridad] = useState<PrioridadIncidencia | "">("");
  const [categoria, setCategoria] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!incidencia) return;
    setEstado(incidencia.estado);
    setPrioridad(incidencia.prioridad ?? "");
    setCategoria(incidencia.categoria ?? "");
    setResponsableId(incidencia.responsableId ?? "");
  }, [incidencia?.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const actualizada = await incidenciasApi.actualizar(id, {
        estado: estado || undefined,
        prioridad: prioridad || undefined,
        categoria: categoria || undefined,
        responsableId: responsableId || null,
        observacion: observacion || undefined,
      });
      setObservacion("");
      setData({ ...incidencia, ...actualizada } as Incidencia);
      toast.success("Incidencia actualizada.");
      recargar();
      onActualizada();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={incidencia?.titulo ?? "Incidencia"}>
      {cargando || !incidencia ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-300">{incidencia.descripcion}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Ubicacion reportada: {incidencia.ubicacion}</p>
            {incidencia.fotoUrl && (
              <img src={incidencia.fotoUrl} alt="Evidencia" className="mt-2 max-h-48 rounded-lg border border-slate-200 dark:border-slate-700" />
            )}
          </div>

          {incidencia.sugerenciaIA && (
            <Alert tone="amber">
              <p className="font-semibold">Sugerencia de IA (revisa y confirma antes de aplicar)</p>
              <p>
                Categoria: {incidencia.sugerenciaIA.categoria} · Prioridad: {PRIORIDAD_LABEL[incidencia.sugerenciaIA.prioridad] ?? incidencia.sugerenciaIA.prioridad} · Ubicacion
                detectada: {incidencia.sugerenciaIA.ubicacionDetectada ?? "no detectada"} · Confianza:{" "}
                {incidencia.sugerenciaIA.confianza}
              </p>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-100 dark:border-slate-700/60 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="campo-incidencias-1">Estado</Label>
                <Select id="campo-incidencias-1" value={estado} onChange={(e) => setEstado(e.target.value as EstadoIncidencia)}>
                  {ESTADOS.map((e2) => (
                    <option key={e2} value={e2}>
                      {ESTADO_INCIDENCIA_LABEL[e2]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="campo-incidencias-2">Prioridad</Label>
                <Select id="campo-incidencias-2" value={prioridad} onChange={(e) => setPrioridad(e.target.value as PrioridadIncidencia)}>
                  <option value="">Sin definir</option>
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORIDAD_LABEL[p]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="campo-incidencias-3">Categoría</Label>
                <Input id="campo-incidencias-3" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ej: Filtracion" />
              </div>
              <div>
                <Label htmlFor="campo-incidencias-4">Responsable</Label>
                <Select id="campo-incidencias-4" value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {admins?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} {a.apellido}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="campo-incidencias-5">Observación (queda en el historial)</Label>
              <Textarea id="campo-incidencias-5" rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
            </div>
            {error && <Alert tone="red">{error}</Alert>}
            <Button type="submit" className="w-full" loading={guardando}>
              Guardar cambios
            </Button>
          </form>

          <div className="border-t border-slate-100 dark:border-slate-700/60 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Historial</p>
            <div className="space-y-2">
              {incidencia.historial?.map((h) => (
                <div key={h.id} className="rounded-lg bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  <p>
                    <span className="font-medium">{ESTADO_INCIDENCIA_LABEL[h.estadoNuevo] ?? h.estadoNuevo}</span>
                    {h.estadoAnterior && (
                      <span className="text-slate-400 dark:text-slate-500">
                        {" "}
                        (antes: {ESTADO_INCIDENCIA_LABEL[h.estadoAnterior] ?? h.estadoAnterior})
                      </span>
                    )}{" "}
                    ·{" "}
                    {h.usuario.nombre} {h.usuario.apellido} · {formatFechaHora(h.createdAt)}
                  </p>
                  {h.observacion && <p className="mt-0.5 text-slate-500 dark:text-slate-400">{h.observacion}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
