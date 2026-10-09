import { FormEvent, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { CaretRight, Siren, Wrench } from "@phosphor-icons/react";
import { incidenciasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { useAcercarAlAparecer } from "../../hooks/useAcercarAlAparecer";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Label,
  Modal,
  PageHeader,
  Spinner,
  Textarea,
} from "../../components/ui";
import { BadgeEstadoIncidencia, HistorialIncidencia, SeguimientoIncidencia } from "../../components/Incidencias";
import { formatFechaHora } from "../../lib/format";
import { PRIORIDAD_LABEL, PRIORIDAD_TONO } from "../../lib/badges";
import { CATEGORIAS_INCIDENCIA, etiquetaCategoria, iconoCategoria } from "../../lib/categorias";
import type { Incidencia } from "../../types";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";

// Una incidencia en "Mis incidencias". La recien reportada entra con un movimiento corto y, si la lista
// quedo fuera de la pantalla (con una columna el formulario esta arriba), se acerca para confirmarlo.
function FilaMiIncidencia({ inc, nueva, onAbrir }: { inc: Incidencia; nueva: boolean; onAbrir: () => void }) {
  const Icono = iconoCategoria(inc.categoria);
  const ref = useAcercarAlAparecer<HTMLLIElement>(nueva, 1279);
  return (
    <li ref={ref} className={clsx(nueva && "animate-aparece")}>
      <button
        type="button"
        onClick={onAbrir}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:hover:bg-slate-700/60"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <Icono size={20} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{inc.titulo}</span>
            <BadgeEstadoIncidencia estado={inc.estado} />
          </span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            {[etiquetaCategoria(inc.categoria), inc.ubicacion, `Reportada el ${formatFechaHora(inc.createdAt)}`].filter(Boolean).join(" · ")}
          </span>
        </span>
        <CaretRight size={16} weight="bold" className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
      </button>
    </li>
  );
}

export default function ResidenteIncidencias() {
  const toast = useToast();
  const { data, cargando, error, recargar } = useAsync(() => incidenciasApi.mias(), []);
  const [params, setParams] = useSearchParams();
  const abiertaId = params.get("ver");

  const [categoria, setCategoria] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [nuevaId, setNuevaId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function abrir(id: string | null) {
    setParams(id ? { ver: id } : {}, { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("titulo", titulo.trim());
      formData.append("descripcion", descripcion.trim());
      formData.append("ubicacion", ubicacion.trim());
      if (categoria) formData.append("categoria", categoria);
      formData.append("urgente", urgente ? "true" : "false");
      const archivo = fileRef.current?.files?.[0];
      if (archivo) formData.append("foto", archivo);

      const creada = await incidenciasApi.crear(formData);
      setNuevaId(creada.id);
      setCategoria("");
      setTitulo("");
      setDescripcion("");
      setUbicacion("");
      setUrgente(false);
      if (fileRef.current) fileRef.current.value = "";
      toast.success(
        urgente ? "Incidencia reportada. La administración fue avisada de inmediato." : "Incidencia reportada. Puedes seguir su avance aquí."
      );
      recargar();
    } catch (err) {
      setFormError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Wrench} title="Incidencias" subtitle="Reporta problemas del condominio y sigue su avance." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card plana className="h-fit xl:col-span-2">
          <CardHeader nivel={2} title="Reportar un problema" />
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <fieldset>
              <legend className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                ¿De qué se trata? (opcional)
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIAS_INCIDENCIA.map(({ codigo, etiqueta, icono: Icono }) => {
                  const elegida = categoria === codigo;
                  return (
                    <button
                      key={codigo}
                      type="button"
                      aria-pressed={elegida}
                      onClick={() => setCategoria(elegida ? "" : codigo)}
                      className={clsx(
                        "flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors",
                        elegida
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      )}
                    >
                      <Icono size={18} weight={elegida ? "fill" : "regular"} className="shrink-0" aria-hidden />
                      {etiqueta}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Si no estás seguro, déjalo sin elegir: el sistema propone una categoría y la administración la revisa.
              </p>
            </fieldset>
            <div>
              <Label htmlFor="campo-incidencia-titulo">Título</Label>
              <Input
                id="campo-incidencia-titulo"
                required
                maxLength={120}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Filtración en el baño"
              />
            </div>
            <div>
              <Label htmlFor="campo-incidencia-ubicacion">Ubicación</Label>
              <Input
                id="campo-incidencia-ubicacion"
                required
                maxLength={120}
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej: Estacionamiento subterráneo"
              />
            </div>
            <div>
              <Label htmlFor="campo-incidencia-descripcion">Descripción</Label>
              <Textarea
                id="campo-incidencia-descripcion"
                required
                rows={4}
                maxLength={2000}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Cuéntanos qué pasa, desde cuándo y cualquier detalle útil."
              />
            </div>
            <div>
              <Label htmlFor="campo-incidencia-foto">Fotografía (opcional)</Label>
              <input
                id="campo-incidencia-foto"
                ref={fileRef}
                type="file"
                accept="image/*"
                className="block w-full text-sm text-slate-600 file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:text-slate-300 dark:file:bg-brand-500/15 dark:file:text-brand-200"
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-600">
              <input
                type="checkbox"
                checked={urgente}
                onChange={(e) => setUrgente(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-red-600"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                <span className="font-semibold">Es urgente</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Hay riesgo para las personas o un daño que empeora (por ejemplo, una filtración activa). La administración recibe un
                  aviso de inmediato.
                </span>
              </span>
            </label>
            <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Siren size={16} weight="fill" className="shrink-0 text-red-500" aria-hidden />
              Ante una emergencia (incendio, robo, accidente), usa el botón rojo SOS.
            </p>
            {formError && <Alert tone="red">{formError}</Alert>}
            <Button type="submit" className="w-full" loading={enviando}>
              Reportar incidencia
            </Button>
          </form>
        </Card>

        <Card plana className="h-fit xl:col-span-3">
          <CardHeader nivel={2} title="Mis incidencias" subtitle="Toca una para ver su avance y los comentarios." />
          {cargando && !data ? (
            <Spinner />
          ) : error ? (
            <Alert tone="red">{error}</Alert>
          ) : !data?.length ? (
            <EmptyState ilustracion="herramienta" title="Aún no has reportado incidencias" description="Si algo falla en el condominio, cuéntalo con el formulario." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {data.map((inc) => (
                <FilaMiIncidencia key={inc.id} inc={inc} nueva={inc.id === nuevaId} onAbrir={() => abrir(inc.id)} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {abiertaId && <DetalleMiIncidencia id={abiertaId} onClose={() => abrir(null)} />}
    </div>
  );
}

function DetalleMiIncidencia({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: inc, cargando, error } = useAsync(() => incidenciasApi.obtener(id), [id]);

  return (
    <Modal open onClose={onClose} title={inc?.titulo ?? "Incidencia"}>
      {cargando && !inc ? (
        <Spinner />
      ) : error || !inc ? (
        <Alert tone="red">{error ?? "No se pudo cargar la incidencia."}</Alert>
      ) : (
        <div className="space-y-5">
          <SeguimientoIncidencia incidencia={inc} />

          <dl className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 dark:bg-slate-900/40">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Categoría</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{etiquetaCategoria(inc.categoria) ?? "Sin categoría"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Prioridad</dt>
              <dd>{inc.prioridad ? <Badge tone={PRIORIDAD_TONO[inc.prioridad]}>{PRIORIDAD_LABEL[inc.prioridad]}</Badge> : "Por definir"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Ubicación</dt>
              <dd className="text-slate-800 dark:text-slate-100">{inc.ubicacion}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Responsable</dt>
              <dd className="text-slate-800 dark:text-slate-100">
                {inc.responsable ? `${inc.responsable.nombre} ${inc.responsable.apellido}` : "Aún sin asignar"}
              </dd>
            </div>
          </dl>

          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Descripción</h4>
            <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{inc.descripcion}</p>
          </div>

          {inc.fotoUrl && (
            <img
              src={inc.fotoUrl}
              alt="Foto de la incidencia"
              className="max-h-64 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-slate-700 dark:bg-slate-900/40"
            />
          )}

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Historial y comentarios</h4>
            <HistorialIncidencia historial={inc.historial ?? []} />
          </div>

          {inc.estado !== "RESUELTA" && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Te avisaremos cuando cambie de estado o la administración deje un comentario. Ante una emergencia, usa el botón rojo SOS.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
