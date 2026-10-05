import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import clsx from "clsx";
import { ArrowUUpLeft, HandArrowUp, Package, Warning } from "@phosphor-icons/react";
import { encomiendasApi } from "../api/endpoints";
import { mensajeError } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useFiltroUrl } from "../hooks/useFiltroUrl";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, Card, EmptyState, Input, Label, Modal, SearchInput, Select, Spinner, staggerFade, Textarea } from "./ui";
import { formatFechaHora } from "../lib/format";
import { fechaEnRango } from "../lib/filters";
import { haceCuanto, nivelAntiguedad } from "../lib/tiempo";
import { ENCOMIENDA_ATRASADA_HORAS } from "../lib/umbrales";
import { ESTADO_ENCOMIENDA_LABEL, ESTADO_ENCOMIENDA_TONO } from "../lib/badges";
import type { Encomienda } from "../types";

export function unidadDe(usuario: Encomienda["usuario"]): string | null {
  if (!usuario?.departamento) return null;
  return [usuario.departamento.torre?.nombre, usuario.departamento.numero].filter(Boolean).join(" ");
}

// "Recibida hace 3 horas": neutra hasta las 48 h, amarilla desde las 48 h y roja desde las 72 h.
// Solo para encomiendas que siguen por retirar.
export function AntiguedadEncomienda({ encomienda }: { encomienda: Pick<Encomienda, "estado" | "fechaRecepcion"> }) {
  if (encomienda.estado !== "NOTIFICADA") return null;
  const nivel = nivelAntiguedad(encomienda.fechaRecepcion);
  const texto = `Recibida ${haceCuanto(encomienda.fechaRecepcion)}`;
  if (nivel === "normal") return <span className="text-xs text-slate-500 dark:text-slate-400">{texto}</span>;
  return (
    <Badge tone={nivel === "muyAtrasada" ? "red" : "amber"}>
      <Warning size={12} weight="fill" className="mr-1" aria-hidden />
      {texto}
    </Badge>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}

// Detalle de una encomienda (con la foto). Conserjeria puede entregarla o devolverla desde aqui.
export function ModalEncomienda({
  id,
  onClose,
  puedeGestionar = false,
  mostrarResidente = true,
  onActualizada,
}: {
  id: string;
  onClose: () => void;
  puedeGestionar?: boolean;
  mostrarResidente?: boolean;
  onActualizada?: () => void;
}) {
  const toast = useToast();
  const { data: enc, cargando, error, recargar } = useAsync(() => encomiendasApi.obtener(id), [id]);
  const [modo, setModo] = useState<"entregar" | "devolver">("entregar");
  const [retiradaPor, setRetiradaPor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  useEffect(() => {
    if (enc?.usuario) setRetiradaPor(`${enc.usuario.nombre} ${enc.usuario.apellido}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enc?.id]);

  async function ejecutar(e: FormEvent, accion: () => Promise<unknown>, mensajeOk: string) {
    e.preventDefault();
    setErrorAccion(null);
    setEnviando(true);
    try {
      await accion();
      toast.success(mensajeOk);
      onActualizada?.();
      onClose();
    } catch (err) {
      // Si otra persona alcanzo a entregarla o devolverla, se muestra el estado actualizado.
      setErrorAccion(mensajeError(err));
      recargar();
      onActualizada?.();
    } finally {
      setEnviando(false);
    }
  }

  const unidad = unidadDe(enc?.usuario);
  const pendiente = enc?.estado === "NOTIFICADA";

  return (
    <Modal open onClose={onClose} title={enc?.remitente ? `Encomienda de ${enc.remitente}` : "Detalle de la encomienda"}>
      {cargando && !enc ? (
        <Spinner />
      ) : error || !enc ? (
        <Alert tone="red">{error ?? "No se pudo cargar la encomienda."}</Alert>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ESTADO_ENCOMIENDA_TONO[enc.estado]}>{ESTADO_ENCOMIENDA_LABEL[enc.estado]}</Badge>
            <AntiguedadEncomienda encomienda={enc} />
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mostrarResidente && enc.usuario && (
              <Dato etiqueta="Residente">
                {enc.usuario.nombre} {enc.usuario.apellido}
                {unidad && <span className="text-slate-500 dark:text-slate-400"> · {unidad}</span>}
              </Dato>
            )}
            <Dato etiqueta="Remitente">{enc.remitente ?? "Sin especificar"}</Dato>
            {enc.numeroSeguimiento && <Dato etiqueta="N° de seguimiento">{enc.numeroSeguimiento}</Dato>}
            {enc.ubicacion && <Dato etiqueta="Ubicación en conserjería">{enc.ubicacion}</Dato>}
            <Dato etiqueta="Recibida">
              {formatFechaHora(enc.fechaRecepcion)}
              {enc.registradaPor && (
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Registrada por {enc.registradaPor.nombre} {enc.registradaPor.apellido}
                </span>
              )}
            </Dato>
            {enc.estado === "RETIRADA" && enc.fechaRetiro && (
              <Dato etiqueta="Entregada">
                {formatFechaHora(enc.fechaRetiro)}
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {enc.retiradaPor ? `La retiró ${enc.retiradaPor}` : ""}
                  {enc.cerradaPor ? `${enc.retiradaPor ? " · " : ""}Entregó ${enc.cerradaPor.nombre} ${enc.cerradaPor.apellido}` : ""}
                </span>
              </Dato>
            )}
            {enc.estado === "DEVUELTA" && enc.fechaDevolucion && (
              <Dato etiqueta="Devuelta al remitente">
                {formatFechaHora(enc.fechaDevolucion)}
                {enc.cerradaPor && (
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Por {enc.cerradaPor.nombre} {enc.cerradaPor.apellido}
                  </span>
                )}
              </Dato>
            )}
          </dl>

          {enc.estado === "DEVUELTA" && enc.motivoDevolucion && (
            <Dato etiqueta="Motivo de la devolución">{enc.motivoDevolucion}</Dato>
          )}
          {enc.observaciones && <Dato etiqueta="Observaciones">{enc.observaciones}</Dato>}

          {enc.fotoUrl && (
            <img
              src={enc.fotoUrl}
              alt="Foto de la encomienda"
              className="max-h-72 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-slate-700 dark:bg-slate-900/40"
            />
          )}

          {errorAccion && <Alert tone="amber">{errorAccion}</Alert>}

          {puedeGestionar && pendiente && (
            <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-700/60">
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Acción">
                {(
                  [
                    ["entregar", "Entregar", HandArrowUp],
                    ["devolver", "Devolver al remitente", ArrowUUpLeft],
                  ] as const
                ).map(([valor, texto, Icono]) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={modo === valor}
                    onClick={() => {
                      setModo(valor);
                      setErrorAccion(null);
                    }}
                    className={clsx(
                      "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-medium transition-colors",
                      modo === valor
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    )}
                  >
                    <Icono size={16} aria-hidden /> {texto}
                  </button>
                ))}
              </div>

              {modo === "entregar" ? (
                <form
                  onSubmit={(e) =>
                    ejecutar(e, () => encomiendasApi.entregar(enc.id, retiradaPor.trim() || undefined), "Encomienda entregada.")
                  }
                  className="space-y-3"
                >
                  <div>
                    <Label htmlFor="campo-encomienda-retira">Nombre de quien la retira</Label>
                    <Input
                      id="campo-encomienda-retira"
                      required
                      maxLength={120}
                      value={retiradaPor}
                      onChange={(e) => setRetiradaPor(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Si la retira otra persona (un familiar, por ejemplo), escribe su nombre. El residente recibirá un aviso.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" loading={enviando}>
                    Confirmar entrega
                  </Button>
                </form>
              ) : (
                <form onSubmit={(e) => ejecutar(e, () => encomiendasApi.devolver(enc.id, motivo.trim()), "Encomienda devuelta al remitente.")} className="space-y-3">
                  <div>
                    <Label htmlFor="campo-encomienda-motivo">Motivo de la devolución</Label>
                    <Textarea
                      id="campo-encomienda-motivo"
                      required
                      rows={2}
                      maxLength={300}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ej: No se retiró en 7 días; la retiró la empresa de despacho."
                    />
                  </div>
                  <Button type="submit" variant="danger" className="w-full" loading={enviando}>
                    Confirmar devolución
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

const FILTROS_ESTADO = ["NOTIFICADA", "ATRASADA", "RETIRADA", "DEVUELTA"] as const;
const ETIQUETA_FILTRO: Record<(typeof FILTROS_ESTADO)[number], string> = {
  NOTIFICADA: "Por retirar",
  ATRASADA: `Por retirar hace más de ${ENCOMIENDA_ATRASADA_HORAS} h`,
  RETIRADA: "Retiradas",
  DEVUELTA: "Devueltas",
};

// Lista de encomiendas del condominio (conserjeria y administracion): filtros, tabla y detalle.
// El filtro de estado y la encomienda abierta viajan en la direccion (?estado=... y ?ver=...).
export function ListaEncomiendas({
  data,
  cargando,
  error,
  puedeGestionar,
  onActualizada,
}: {
  data: Encomienda[] | null;
  cargando: boolean;
  error: string | null;
  puedeGestionar: boolean;
  onActualizada: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useFiltroUrl("estado", FILTROS_ESTADO);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const abiertaId = params.get("ver");

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

  const filtradas = (data ?? []).filter((enc) => {
    const texto = [
      enc.usuario?.nombre,
      enc.usuario?.apellido,
      unidadDe(enc.usuario),
      enc.remitente,
      enc.numeroSeguimiento,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const coincideTexto = !busqueda || texto.includes(busqueda.toLowerCase());
    const coincideEstado =
      !estado ||
      (estado === "ATRASADA"
        ? enc.estado === "NOTIFICADA" && nivelAntiguedad(enc.fechaRecepcion) !== "normal"
        : enc.estado === estado);
    return coincideTexto && coincideEstado && fechaEnRango(enc.fechaRecepcion, fechaDesde, fechaHasta);
  });

  const hayFiltros = Boolean(busqueda || estado || fechaDesde || fechaHasta);

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-5 dark:border-slate-700/60">
        <div className="w-full sm:max-w-[16rem]">
          <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por residente, unidad o remitente..." />
        </div>
        <div className="w-full sm:w-56">
          <Label htmlFor="campo-encomiendas-estado">Estado</Label>
          <Select id="campo-encomiendas-estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
            <option value="">Todas</option>
            {FILTROS_ESTADO.map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETA_FILTRO[valor]}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="campo-encomiendas-desde">Recibidas desde</Label>
          <Input id="campo-encomiendas-desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="campo-encomiendas-hasta">Hasta</Label>
          <Input id="campo-encomiendas-hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setEstado("");
              setFechaDesde("");
              setFechaHasta("");
            }}
            className="text-xs text-brand-600 hover:underline max-sm:min-h-11 dark:text-brand-400"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {cargando && !data ? (
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
            <thead className="border-b border-slate-100 text-xs uppercase text-slate-400 dark:border-slate-700/60 dark:text-slate-500">
              <tr>
                <th className="px-5 py-3">Residente</th>
                <th className="px-5 py-3">Remitente</th>
                <th className="px-5 py-3">Recepción</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filtradas.map((enc, i) => (
                <motion.tr key={enc.id} {...staggerFade(i)} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                  <td data-label="Residente" className="px-5 py-3">
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {enc.usuario ? `${enc.usuario.nombre} ${enc.usuario.apellido}` : "—"}
                      </span>
                      {unidadDe(enc.usuario) && (
                        <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{unidadDe(enc.usuario)}</span>
                      )}
                    </div>
                  </td>
                  <td data-label="Remitente" className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    <div>
                      <span>{enc.remitente ?? "Sin especificar"}</span>
                      {enc.numeroSeguimiento && (
                        <span className="block text-xs text-slate-500 dark:text-slate-400">N° {enc.numeroSeguimiento}</span>
                      )}
                    </div>
                  </td>
                  <td data-label="Recepción" className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="whitespace-nowrap">{formatFechaHora(enc.fechaRecepcion)}</span>
                      {enc.estado === "NOTIFICADA" && (
                        <span className="block pt-0.5">
                          <AntiguedadEncomienda encomienda={enc} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Estado" className="px-5 py-3">
                    <Badge tone={ESTADO_ENCOMIENDA_TONO[enc.estado]}>{ESTADO_ENCOMIENDA_LABEL[enc.estado]}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {puedeGestionar && enc.estado === "NOTIFICADA" ? (
                      <Button size="sm" className="whitespace-nowrap" onClick={() => abrir(enc.id)}>
                        <HandArrowUp size={14} aria-hidden /> Entregar
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => abrir(enc.id)}>
                        Ver detalle
                      </Button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abiertaId && (
        <ModalEncomienda
          id={abiertaId}
          puedeGestionar={puedeGestionar}
          onClose={() => abrir(null)}
          onActualizada={onActualizada}
        />
      )}
    </Card>
  );
}
