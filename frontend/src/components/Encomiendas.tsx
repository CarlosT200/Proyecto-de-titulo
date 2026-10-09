import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { ArrowUUpLeft, HandArrowUp, MapPin, Package, Warning } from "@phosphor-icons/react";
import { encomiendasApi } from "../api/endpoints";
import { mensajeError } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useFiltroUrl } from "../hooks/useFiltroUrl";
import { useEsCelular } from "../hooks/useEsCelular";
import { useAcercarAlAparecer } from "../hooks/useAcercarAlAparecer";
import { usePulsoAlCambiar } from "../hooks/usePulsoAlCambiar";
import { useToast } from "../context/ToastContext";
import { CeldaResumen } from "./CeldaResumen";
import { Alert, Badge, Button, Card, EmptyState, Input, Label, Modal, SearchInput, Select, Spinner, Textarea } from "./ui";
import { formatFechaHora } from "../lib/format";
import { fechaEnRango } from "../lib/filters";
import { esAtrasada, esPorRetirar, ordenarEncomiendas, retiradaHoy } from "../lib/encomiendas";
import { haceCuanto, nivelAntiguedad } from "../lib/tiempo";
import { ENCOMIENDA_ATRASADA_HORAS } from "../lib/umbrales";
import { ESTADO_ENCOMIENDA_LABEL, ESTADO_ENCOMIENDA_TONO } from "../lib/badges";
import type { Encomienda, EstadoEncomienda } from "../types";

// Cuando el estado cambia (se entrega o se devuelve) la insignia entra con un movimiento corto para que
// se note; al cargar la pagina no se mueve.
export function BadgeEstadoEncomienda({ estado }: { estado: EstadoEncomienda }) {
  const pulso = usePulsoAlCambiar(estado);
  return (
    <span key={pulso} className={clsx("inline-flex", pulso > 0 && "animate-aparece")}>
      <Badge tone={ESTADO_ENCOMIENDA_TONO[estado]}>{ESTADO_ENCOMIENDA_LABEL[estado]}</Badge>
    </span>
  );
}

// La encomienda recien registrada entra con un movimiento corto y, si quedo fuera de la pantalla
// (en celular la lista es larga), se acerca para confirmar que quedo registrada.
function ItemTarjeta({ nueva, children }: { nueva: boolean; children: ReactNode }) {
  const ref = useAcercarAlAparecer<HTMLLIElement>(nueva, 1279);
  return (
    <li ref={ref} className={clsx("space-y-1.5 px-5 py-3.5", nueva && "animate-aparece")}>
      {children}
    </li>
  );
}

function FilaTabla({ nueva, children }: { nueva: boolean; children: ReactNode }) {
  const ref = useAcercarAlAparecer<HTMLTableRowElement>(nueva, 1279);
  return (
    <tr ref={ref} className={clsx(nueva && "animate-aparece")}>
      {children}
    </tr>
  );
}

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
  if (nivel === "normal") return <span className="text-sm text-slate-600 dark:text-slate-300">{texto}</span>;
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
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{etiqueta}</dt>
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
            <BadgeEstadoEncomienda estado={enc.estado} />
            <AntiguedadEncomienda encomienda={enc} />
          </div>

          {pendiente && enc.ubicacion && (
            <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-slate-800 dark:bg-brand-500/15 dark:text-slate-100">
              <MapPin size={18} weight="fill" className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
              <span>
                Guardada en <strong className="font-semibold">{enc.ubicacion}</strong>
              </span>
            </p>
          )}

          {enc.fotoUrl && (
            <img
              src={enc.fotoUrl}
              alt="Foto de la encomienda"
              className="max-h-72 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-slate-700 dark:bg-slate-900/40"
            />
          )}

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mostrarResidente && enc.usuario && (
              <Dato etiqueta="Residente">
                {enc.usuario.nombre} {enc.usuario.apellido}
                {unidad && <span className="text-slate-500 dark:text-slate-400"> · {unidad}</span>}
              </Dato>
            )}
            <Dato etiqueta="Remitente">{enc.remitente ?? "Sin especificar"}</Dato>
            {enc.numeroSeguimiento && <Dato etiqueta="N° de seguimiento">{enc.numeroSeguimiento}</Dato>}
            {enc.ubicacion && !pendiente && <Dato etiqueta="Ubicación en conserjería">{enc.ubicacion}</Dato>}
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

const FILTROS_ESTADO = ["NOTIFICADA", "ATRASADA", "RETIRADA_HOY", "RETIRADA", "DEVUELTA"] as const;
type FiltroEstado = (typeof FILTROS_ESTADO)[number];
const ETIQUETA_FILTRO: Record<FiltroEstado, string> = {
  NOTIFICADA: "Por retirar",
  ATRASADA: `Por retirar hace más de ${ENCOMIENDA_ATRASADA_HORAS} h`,
  RETIRADA_HOY: "Retiradas hoy",
  RETIRADA: "Retiradas",
  DEVUELTA: "Devueltas",
};
// Mas cortas para el selector en un celular (comparte la pantalla con otros campos).
const ETIQUETA_FILTRO_CORTA: Record<FiltroEstado, string> = {
  NOTIFICADA: "Por retirar",
  ATRASADA: "Atrasadas",
  RETIRADA_HOY: "Retiradas hoy",
  RETIRADA: "Retiradas",
  DEVUELTA: "Devueltas",
};

function coincideEstado(enc: Encomienda, estado: FiltroEstado | ""): boolean {
  if (!estado) return true;
  if (estado === "ATRASADA") return esAtrasada(enc);
  if (estado === "RETIRADA_HOY") return retiradaHoy(enc);
  return enc.estado === estado;
}

// Lo que importa al abrir la pantalla; cada cifra filtra la lista (y se vuelve a tocar para quitar el
// filtro). Se calcula con todas las encomiendas, no con el filtro.
function ResumenEncomiendas({
  encomiendas,
  filtro,
  onFiltrar,
}: {
  encomiendas: Encomienda[];
  filtro: FiltroEstado | "";
  onFiltrar: (estado: FiltroEstado | "") => void;
}) {
  const porRetirar = encomiendas.filter(esPorRetirar).length;
  const atrasadas = encomiendas.filter(esAtrasada);
  const hayMuyAtrasadas = atrasadas.some((e) => nivelAntiguedad(e.fechaRecepcion) === "muyAtrasada");
  const hoy = encomiendas.filter(retiradaHoy).length;
  const alternar = (valor: FiltroEstado) => onFiltrar(filtro === valor ? "" : valor);
  return (
    <Card plana className="overflow-hidden">
      <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-700/60">
        <CeldaResumen titulo="Por retirar" valor={porRetirar} detalle="en conserjería" activa={filtro === "NOTIFICADA"} onToggle={() => alternar("NOTIFICADA")} />
        <CeldaResumen
          titulo="Atrasadas"
          valor={atrasadas.length}
          detalle={`más de ${ENCOMIENDA_ATRASADA_HORAS} h`}
          alerta={hayMuyAtrasadas ? "red" : "amber"}
          activa={filtro === "ATRASADA"}
          onToggle={() => alternar("ATRASADA")}
        />
        <CeldaResumen
          titulo="Entregadas"
          valor={hoy}
          detalle="hoy"
          activa={filtro === "RETIRADA_HOY"}
          onToggle={() => alternar("RETIRADA_HOY")}
        />
      </div>
    </Card>
  );
}

// Lista de encomiendas del condominio (conserjeria y administracion): resumen, filtros, lista y detalle.
// El filtro de estado y la encomienda abierta viajan en la direccion (?estado=... y ?ver=...).
export function ListaEncomiendas({
  data,
  cargando,
  error,
  puedeGestionar,
  onActualizada,
  nuevaId = null,
}: {
  data: Encomienda[] | null;
  cargando: boolean;
  error: string | null;
  puedeGestionar: boolean;
  onActualizada: () => void;
  /** Encomienda recien registrada: entra con movimiento y se acerca a la vista. */
  nuevaId?: string | null;
}) {
  const [params, setParams] = useSearchParams();
  const esCelular = useEsCelular();
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

  const filtradas = ordenarEncomiendas(
    (data ?? []).filter((enc) => {
      const texto = [enc.usuario?.nombre, enc.usuario?.apellido, unidadDe(enc.usuario), enc.remitente, enc.numeroSeguimiento]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const coincideTexto = !busqueda || texto.includes(busqueda.toLowerCase());
      return coincideTexto && coincideEstado(enc, estado) && fechaEnRango(enc.fechaRecepcion, fechaDesde, fechaHasta);
    })
  );

  const hayFiltros = Boolean(busqueda || estado || fechaDesde || fechaHasta);
  const etiquetas = esCelular ? ETIQUETA_FILTRO_CORTA : ETIQUETA_FILTRO;

  const nombreDe = (enc: Encomienda) => (enc.usuario ? `${enc.usuario.nombre} ${enc.usuario.apellido}` : "—");
  const accion = (enc: Encomienda, className?: string) =>
    puedeGestionar && enc.estado === "NOTIFICADA" ? (
      <Button size="sm" className={clsx("whitespace-nowrap", className)} onClick={() => abrir(enc.id)}>
        <HandArrowUp size={14} aria-hidden /> Entregar
      </Button>
    ) : (
      <Button size="sm" variant="secondary" className={clsx("whitespace-nowrap", className)} onClick={() => abrir(enc.id)}>
        Ver detalle
      </Button>
    );

  return (
    <div className="space-y-6">
      {data && data.length > 0 && <ResumenEncomiendas encomiendas={data} filtro={estado} onFiltrar={setEstado} />}

      <Card plana>
        <div className="grid grid-cols-2 items-end gap-3 border-b border-slate-100 p-5 dark:border-slate-700/60 sm:flex sm:flex-wrap">
          <div className="col-span-2 sm:w-64">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por residente, unidad o remitente..." />
          </div>
          <div className="col-span-2 sm:w-56">
            <Label htmlFor="campo-encomiendas-estado">Estado</Label>
            <Select id="campo-encomiendas-estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
              <option value="">Todas</option>
              {FILTROS_ESTADO.map((valor) => (
                <option key={valor} value={valor}>
                  {etiquetas[valor]}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:w-40">
            <Label htmlFor="campo-encomiendas-desde">Recibidas desde</Label>
            <Input id="campo-encomiendas-desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div className="sm:w-40">
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
              className="col-span-2 inline-flex items-center justify-center rounded-lg text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:min-h-11 dark:text-brand-400 sm:col-span-1"
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
          <>
            <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              Primero las que siguen por retirar, de la más antigua a la más reciente; después las anteriores.
            </p>

            {/* Celular: una tarjeta compacta por encomienda (quien, de quien, hace cuanto y la accion).
                Desde 640 px: tabla. */}
            <ul className="divide-y divide-slate-100 sm:hidden dark:divide-slate-700/60">
              {filtradas.map((enc) => (
                <ItemTarjeta key={enc.id} nueva={enc.id === nuevaId}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-medium text-slate-900 dark:text-slate-100">{nombreDe(enc)}</p>
                    <BadgeEstadoEncomienda estado={enc.estado} />
                  </div>
                  <p className="break-words text-sm text-slate-600 dark:text-slate-300">
                    {[unidadDe(enc.usuario), enc.remitente ?? "Sin especificar", enc.numeroSeguimiento && `N° ${enc.numeroSeguimiento}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-sm">
                    {enc.estado === "NOTIFICADA" ? (
                      <AntiguedadEncomienda encomienda={enc} />
                    ) : (
                      <span className="text-slate-600 dark:text-slate-300">Recibida {formatFechaHora(enc.fechaRecepcion)}</span>
                    )}
                  </p>
                  {accion(enc, "mt-1 w-full")}
                </ItemTarjeta>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-3">Residente</th>
                    <th scope="col" className="px-5 py-3">Remitente</th>
                    <th scope="col" className="px-5 py-3">Recepción</th>
                    <th scope="col" className="px-5 py-3">Estado</th>
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filtradas.map((enc) => (
                    <FilaTabla key={enc.id} nueva={enc.id === nuevaId}>
                      <td className="px-5 py-3">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{nombreDe(enc)}</span>
                        {unidadDe(enc.usuario) && (
                          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{unidadDe(enc.usuario)}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        <span>{enc.remitente ?? "Sin especificar"}</span>
                        {enc.numeroSeguimiento && (
                          <span className="block text-xs text-slate-500 dark:text-slate-400">N° {enc.numeroSeguimiento}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        <span className="whitespace-nowrap">{formatFechaHora(enc.fechaRecepcion)}</span>
                        {enc.estado === "NOTIFICADA" && (
                          <span className="block pt-0.5">
                            <AntiguedadEncomienda encomienda={enc} />
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <BadgeEstadoEncomienda estado={enc.estado} />
                      </td>
                      <td className="px-5 py-3 text-right">{accion(enc)}</td>
                    </FilaTabla>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {abiertaId && (
          <ModalEncomienda id={abiertaId} puedeGestionar={puedeGestionar} onClose={() => abrir(null)} onActualizada={onActualizada} />
        )}
      </Card>
    </div>
  );
}
