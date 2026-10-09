import { FormEvent, useState } from "react";
import clsx from "clsx";
import { CheckCircle, FileArrowUp, Receipt, XCircle } from "@phosphor-icons/react";
import { gastosComunesApi } from "../api/endpoints";
import { mensajeError } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAcercarAlAparecer } from "../hooks/useAcercarAlAparecer";
import { usePulsoAlCambiar } from "../hooks/usePulsoAlCambiar";
import { Alert, Badge, Button, EmptyState, Input, Label, Modal, Select, Textarea } from "./ui";
import { formatFecha, formatMonto, hoyLocal, formatDia } from "../lib/format";
import { MEDIO_PAGO_LABEL } from "../lib/badges";
import { nombrePeriodo, nombreUnidad } from "../lib/gastosComunes";
import type { ComprobantePago, ComprobanteParaRevisar, EstadoComprobante, MedioPago } from "../types";

const MAXIMO_BYTES = 8 * 1024 * 1024;
const MEDIOS: MedioPago[] = ["TRANSFERENCIA", "EFECTIVO", "TARJETA", "CHEQUE", "OTRO"];

const ESTADO: Record<EstadoComprobante, { texto: string; tono: "amber" | "green" | "red" }> = {
  PENDIENTE: { texto: "En revisión", tono: "amber" },
  APROBADO: { texto: "Aprobado", tono: "green" },
  RECHAZADO: { texto: "Rechazado", tono: "red" },
};

// Cuando la administracion lo revisa, la insignia entra con un movimiento corto (no al cargar).
export function BadgeComprobante({ estado }: { estado: EstadoComprobante }) {
  const pulso = usePulsoAlCambiar(estado);
  return (
    <span key={pulso} className={clsx("inline-flex shrink-0 whitespace-nowrap", pulso > 0 && "animate-aparece")}>
      <Badge tone={ESTADO[estado].tono}>{ESTADO[estado].texto}</Badge>
    </span>
  );
}

// Abre el archivo en una pestaña nueva (misma tecnica que los documentos: la pestaña se abre en el
// mismo toque y despues recibe el enlace de 2 minutos; si no, se usa la pestaña actual).
export async function abrirComprobante(id: string) {
  const ventana = window.open("", "_blank");
  try {
    const { url } = await gastosComunesApi.enlaceComprobante(id);
    if (ventana) ventana.location.href = url;
    else window.location.href = url;
  } catch (error) {
    ventana?.close();
    throw error;
  }
}

function tamano(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString("es-CL", { maximumFractionDigits: 1 })} MB`;
}

// Residente: informa un pago con la foto o el PDF de su transferencia.
export function FormularioInformarPago({
  cobroId,
  saldo,
  onListo,
  onCancelar,
}: {
  cobroId: string;
  saldo: number;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const toast = useToast();
  const [monto, setMonto] = useState(String(saldo));
  const [fechaPago, setFechaPago] = useState(hoyLocal());
  const [medio, setMedio] = useState<MedioPago>("TRANSFERENCIA");
  const [referencia, setReferencia] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const valor = Number(monto);
    if (!Number.isInteger(valor) || valor <= 0) return setError("Ingresa el monto en pesos, sin decimales.");
    if (valor > saldo) return setError(`El monto supera tu saldo pendiente (${formatMonto(saldo)}).`);
    if (!archivo) return setError("Adjunta la foto o el PDF del comprobante.");
    if (archivo.size > MAXIMO_BYTES) return setError(`El archivo pesa ${tamano(archivo.size)}; el máximo es 8 MB.`);
    setEnviando(true);
    try {
      const datos = new FormData();
      datos.append("monto", String(valor));
      datos.append("fechaPago", fechaPago);
      datos.append("medio", medio);
      if (referencia.trim()) datos.append("referencia", referencia.trim());
      datos.append("archivo", archivo);
      await gastosComunesApi.informarPago(cobroId, datos);
      toast.success("Comprobante enviado. Te avisaremos cuando la administración lo revise.");
      onListo();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Informar un pago</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">La administración lo revisa y, al aprobarlo, se descuenta de tu saldo.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="campo-informar-monto">Monto pagado</Label>
          <Input id="campo-informar-monto" type="number" inputMode="numeric" min={1} max={saldo} step={1} required value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="campo-informar-fecha">Fecha del pago</Label>
          <Input id="campo-informar-fecha" type="date" required max={hoyLocal()} value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="campo-informar-medio">Medio de pago</Label>
          <Select id="campo-informar-medio" value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
            {MEDIOS.map((m) => (
              <option key={m} value={m}>
                {MEDIO_PAGO_LABEL[m]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="campo-informar-referencia">N° de operación (opcional)</Label>
          <Input id="campo-informar-referencia" maxLength={60} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ej: 004512" />
        </div>
      </div>
      <div>
        <Label htmlFor="campo-informar-archivo">Comprobante (foto o PDF, hasta 8 MB)</Label>
        <label
          htmlFor="campo-informar-archivo"
          className="flex min-h-[4.5rem] cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-sm transition-colors hover:border-brand-400 focus-within:border-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-brand-400"
        >
          <FileArrowUp size={24} className="shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
          <span className="min-w-0">
            {archivo ? (
              <>
                <span className="block break-all font-medium text-slate-900 dark:text-slate-100">{archivo.name}</span>
                <span className="text-slate-600 dark:text-slate-300">{tamano(archivo.size)} · toca para cambiarlo</span>
              </>
            ) : (
              <span className="text-slate-700 dark:text-slate-200">Toca para tomar una foto o elegir el archivo</span>
            )}
          </span>
          <input
            id="campo-informar-archivo"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
        </label>
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" loading={enviando}>
          Enviar comprobante
        </Button>
      </div>
    </form>
  );
}

// Lista de pagos informados de un mes (en el detalle del cobro), para el residente y la administracion.
export function ListaComprobantes({ comprobantes }: { comprobantes: ComprobantePago[] }) {
  const toast = useToast();
  if (comprobantes.length === 0) return null;
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Pagos informados con comprobante</h4>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-700/60 dark:border-slate-700">
        {comprobantes.map((c) => (
          <li key={c.id} className="space-y-1 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {formatMonto(c.monto)}
                <span className="font-normal text-slate-600 dark:text-slate-300">
                  {" "}
                  · {MEDIO_PAGO_LABEL[c.medio]}
                  {c.referencia ? ` N° ${c.referencia}` : ""}
                </span>
              </p>
              <BadgeComprobante estado={c.estado} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pagado el {formatFecha(c.fechaPago)} · enviado el {formatDia(c.createdAt)}
              {c.informadoPor ? ` por ${c.informadoPor.nombre} ${c.informadoPor.apellido}` : ""}
            </p>
            {c.estado === "RECHAZADO" && c.motivoRechazo && <p className="text-sm text-red-700 dark:text-red-300">Motivo: {c.motivoRechazo}</p>}
            {c.estado === "APROBADO" && c.pago && c.pago.monto !== c.monto && (
              <p className="text-sm text-slate-700 dark:text-slate-200">Se registraron {formatMonto(c.pago.monto)} de lo informado.</p>
            )}
            <button
              type="button"
              onClick={() => abrirComprobante(c.id).catch((err) => toast.error(mensajeError(err, "No se pudo abrir el comprobante.")))}
              className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded px-1 text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:min-h-0 dark:text-brand-400"
            >
              <Receipt size={14} aria-hidden /> Ver comprobante
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FilaRevision({
  comprobante: c,
  onAprobar,
  onRechazar,
  destacado,
}: {
  comprobante: ComprobanteParaRevisar;
  onAprobar: () => void;
  onRechazar: () => void;
  destacado: boolean;
}) {
  const toast = useToast();
  const ref = useAcercarAlAparecer<HTMLLIElement>(destacado, 1279);
  const pendiente = c.estado === "PENDIENTE";
  return (
    <li ref={ref} className={clsx("flex flex-col gap-3 px-5 py-4", destacado && "animate-aparece")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white">
            {nombreUnidad(c.cobro.departamento)} · {nombrePeriodo(c.cobro.periodo.anio, c.cobro.periodo.mes)}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Informó {c.informadoPor.nombre} {c.informadoPor.apellido} el {formatDia(c.createdAt)}
          </p>
        </div>
        <BadgeComprobante estado={c.estado} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="font-display text-lg font-bold tabular-nums text-slate-900 dark:text-white">{formatMonto(c.monto)}</span>
        <span className="text-slate-600 dark:text-slate-300">
          {MEDIO_PAGO_LABEL[c.medio]}
          {c.referencia ? ` N° ${c.referencia}` : ""} · pagado el {formatFecha(c.fechaPago)}
        </span>
        {pendiente && <span className="text-slate-600 dark:text-slate-300">Saldo del mes: {formatMonto(c.cobro.saldo)}</span>}
      </div>
      {!pendiente && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {c.estado === "APROBADO" ? "Aprobó" : "Rechazó"} {c.revisadoPor ? `${c.revisadoPor.nombre} ${c.revisadoPor.apellido}` : "la administración"}
          {c.revisadoEn ? ` el ${formatDia(c.revisadoEn)}` : ""}
          {c.motivoRechazo ? `. Motivo: ${c.motivoRechazo}` : ""}
          {c.estado === "APROBADO" && c.pago && c.pago.monto !== c.monto ? `. Se registraron ${formatMonto(c.pago.monto)}` : ""}
        </p>
      )}
      <div className={clsx("grid gap-2 sm:flex sm:flex-wrap", pendiente ? "grid-cols-1" : "grid-cols-1")}>
        <Button
          size="sm"
          variant="secondary"
          className="max-sm:min-h-11"
          onClick={() => abrirComprobante(c.id).catch((err) => toast.error(mensajeError(err, "No se pudo abrir el comprobante.")))}
        >
          <Receipt size={14} aria-hidden /> Ver comprobante
        </Button>
        {pendiente && (
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button size="sm" className="max-sm:min-h-11" onClick={onAprobar}>
              <CheckCircle size={14} weight="bold" aria-hidden /> Aprobar
            </Button>
            <Button size="sm" variant="secondary" className="text-red-700 max-sm:min-h-11 dark:text-red-300" onClick={onRechazar}>
              <XCircle size={14} aria-hidden /> Rechazar
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

// Administracion: comprobantes por revisar (primero) y los revisados recientemente.
export function RevisionComprobantes({
  comprobantes,
  onRevisado,
}: {
  comprobantes: ComprobanteParaRevisar[];
  onRevisado: () => void;
}) {
  const toast = useToast();
  const [aprobando, setAprobando] = useState<ComprobanteParaRevisar | null>(null);
  const [rechazando, setRechazando] = useState<ComprobanteParaRevisar | null>(null);
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisadoId, setRevisadoId] = useState<string | null>(null);

  const pendientes = comprobantes.filter((c) => c.estado === "PENDIENTE");
  const revisados = comprobantes.filter((c) => c.estado !== "PENDIENTE");

  function cerrar() {
    setAprobando(null);
    setRechazando(null);
    setError(null);
  }

  async function aprobar(e: FormEvent) {
    e.preventDefault();
    if (!aprobando) return;
    setError(null);
    const valor = Number(monto);
    if (!Number.isInteger(valor) || valor <= 0 || valor > aprobando.monto) {
      return setError(`Ingresa un monto entero entre $1 y ${formatMonto(aprobando.monto)}.`);
    }
    setEnviando(true);
    try {
      const r = await gastosComunesApi.aprobarComprobante(aprobando.id, valor === aprobando.monto ? undefined : valor);
      toast.success(r.pagado ? `Pago aprobado. ${r.unidad} quedó al día en ${r.periodo}.` : `Pago aprobado. Saldo pendiente de ${r.unidad}: ${formatMonto(r.saldo)}.`);
      setRevisadoId(aprobando.id);
      cerrar();
      onRevisado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  async function rechazar(e: FormEvent) {
    e.preventDefault();
    if (!rechazando) return;
    setError(null);
    setEnviando(true);
    try {
      await gastosComunesApi.rechazarComprobante(rechazando.id, motivo.trim());
      toast.info("Comprobante rechazado. El residente recibió el motivo.");
      setRevisadoId(rechazando.id);
      cerrar();
      onRevisado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {pendientes.length === 0 ? (
        <EmptyState icon={CheckCircle} title="No hay comprobantes por revisar" description="Cuando un residente informe un pago con su comprobante, aparecerá aquí." />
      ) : (
        <>
          <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
            Del más antiguo al más reciente. Al aprobar se registra el pago y se avisa al residente.
          </p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {pendientes.map((c) => (
              <FilaRevision
                key={c.id}
                comprobante={c}
                destacado={false}
                onAprobar={() => {
                  setMonto(String(Math.min(c.monto, c.cobro.saldo)));
                  setAprobando(c);
                }}
                onRechazar={() => {
                  setMotivo("");
                  setRechazando(c);
                }}
              />
            ))}
          </ul>
        </>
      )}

      {revisados.length > 0 && (
        <>
          <h3 className="border-y border-slate-100 bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300">
            Revisados recientemente
          </h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {revisados.map((c) => (
              <FilaRevision key={c.id} comprobante={c} destacado={c.id === revisadoId} onAprobar={() => {}} onRechazar={() => {}} />
            ))}
          </ul>
        </>
      )}

      <Modal open={aprobando !== null} onClose={cerrar} title="Aprobar comprobante">
        {aprobando && (
          <form onSubmit={aprobar} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {nombreUnidad(aprobando.cobro.departamento)} informó {formatMonto(aprobando.monto)} del gasto común de{" "}
              {nombrePeriodo(aprobando.cobro.periodo.anio, aprobando.cobro.periodo.mes)}. Revisa que el comprobante coincida con lo recibido en la
              cuenta antes de aprobar.
            </p>
            <div>
              <Label htmlFor="campo-aprobar-monto">Monto a registrar</Label>
              <Input
                id="campo-aprobar-monto"
                type="number"
                inputMode="numeric"
                min={1}
                max={aprobando.monto}
                step={1}
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Puedes registrar menos si la transferencia fue por un monto distinto. Saldo del mes: {formatMonto(aprobando.cobro.saldo)}.
              </p>
            </div>
            {error && <Alert tone="red">{error}</Alert>}
            <Button type="submit" className="w-full" loading={enviando}>
              <CheckCircle size={16} weight="bold" aria-hidden /> Aprobar y registrar el pago
            </Button>
          </form>
        )}
      </Modal>

      <Modal open={rechazando !== null} onClose={cerrar} title="Rechazar comprobante">
        {rechazando && (
          <form onSubmit={rechazar} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {nombreUnidad(rechazando.cobro.departamento)} · {formatMonto(rechazando.monto)}. El residente verá el motivo y podrá enviar otro comprobante.
            </p>
            <div>
              <Label htmlFor="campo-rechazar-motivo">Motivo</Label>
              <Textarea
                id="campo-rechazar-motivo"
                rows={3}
                required
                minLength={5}
                maxLength={300}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: no aparece la transferencia en la cuenta; la imagen no se lee."
              />
            </div>
            {error && <Alert tone="red">{error}</Alert>}
            <Button type="submit" variant="danger" className="w-full" loading={enviando}>
              Rechazar comprobante
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
