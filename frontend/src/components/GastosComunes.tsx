import { FormEvent, ReactNode, useState } from "react";
import clsx from "clsx";
import { Prohibit, Receipt } from "@phosphor-icons/react";
import { gastosComunesApi } from "../api/endpoints";
import { mensajeError } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, Input, Label, Modal, Select, Spinner, Textarea } from "./ui";
import { formatFecha, formatMonto, hoyLocal } from "../lib/format";
import { ESTADO_COBRO_LABEL, ESTADO_COBRO_TONO, MEDIO_PAGO_LABEL } from "../lib/badges";
import { fechaLarga, nombrePeriodo, nombreUnidad, nombresResidentes } from "../lib/gastosComunes";
import type { CobroGastoComunDetalle, EstadoCobro, MedioPago, PagoGastoComun } from "../types";

export function EstadoCobroBadge({ estado }: { estado: EstadoCobro }) {
  return <Badge tone={ESTADO_COBRO_TONO[estado]}>{ESTADO_COBRO_LABEL[estado]}</Badge>;
}

function Dato({ etiqueta, children, destacado = false }: { etiqueta: string; children: ReactNode; destacado?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{etiqueta}</dt>
      <dd className={clsx("mt-0.5 text-sm text-slate-800 dark:text-slate-100", destacado && "font-display text-lg font-bold")}>{children}</dd>
    </div>
  );
}

// Detalle de los gastos del mes (lo que se gasto en el condominio) con su total.
export function ListaPartidas({ partidas, total }: { partidas: { id: string; concepto: string; monto: number }[]; total: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-700/60">
        {partidas.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-4 px-3 py-2">
            <span className="text-slate-600 dark:text-slate-300">{p.concepto}</span>
            <span className="whitespace-nowrap font-medium text-slate-800 dark:text-slate-100">{formatMonto(p.monto)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900/40 dark:text-white">
        <span>Total del condominio</span>
        <span className="whitespace-nowrap">{formatMonto(total)}</span>
      </div>
    </div>
  );
}

const MEDIOS: MedioPago[] = ["TRANSFERENCIA", "EFECTIVO", "TARJETA", "CHEQUE", "OTRO"];

function FormularioPago({
  cobro,
  onListo,
  onCancelar,
}: {
  cobro: CobroGastoComunDetalle;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const toast = useToast();
  const [monto, setMonto] = useState(String(cobro.saldo));
  const [fechaPago, setFechaPago] = useState(hoyLocal());
  const [medio, setMedio] = useState<MedioPago>("TRANSFERENCIA");
  const [referencia, setReferencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function registrar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const valor = Number(monto);
    if (!Number.isInteger(valor) || valor <= 0) {
      setError("Ingresa un monto en pesos, sin decimales.");
      return;
    }
    if (valor > cobro.saldo) {
      setError(`El monto supera el saldo pendiente (${formatMonto(cobro.saldo)}).`);
      return;
    }
    setEnviando(true);
    try {
      const r = await gastosComunesApi.registrarPago(cobro.id, { monto: valor, fechaPago, medio, referencia: referencia.trim() || undefined });
      toast.success(r.pagado ? `Pago registrado. La unidad ${r.unidad} quedó al día en ${r.periodo}.` : `Pago registrado. Saldo pendiente: ${formatMonto(r.saldo)}.`);
      onListo();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={registrar} className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">Registrar pago</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="campo-pago-monto">Monto</Label>
          <Input
            id="campo-pago-monto"
            type="number"
            inputMode="numeric"
            min={1}
            max={cobro.saldo}
            step={1}
            required
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saldo pendiente: {formatMonto(cobro.saldo)}</p>
        </div>
        <div>
          <Label htmlFor="campo-pago-fecha">Fecha de pago</Label>
          <Input id="campo-pago-fecha" type="date" required max={hoyLocal()} value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="campo-pago-medio">Medio de pago</Label>
          <Select id="campo-pago-medio" value={medio} onChange={(e) => setMedio(e.target.value as MedioPago)}>
            {MEDIOS.map((m) => (
              <option key={m} value={m}>
                {MEDIO_PAGO_LABEL[m]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="campo-pago-referencia">N° de comprobante (opcional)</Label>
          <Input id="campo-pago-referencia" maxLength={60} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ej: 004512" />
        </div>
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" loading={enviando}>
          Registrar pago
        </Button>
      </div>
    </form>
  );
}

function FilaPago({
  pago,
  esAdmin,
  onAnulado,
}: {
  pago: PagoGastoComun;
  esAdmin: boolean;
  onAnulado: () => void;
}) {
  const toast = useToast();
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anulado = Boolean(pago.anuladoEn);

  async function anular(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await gastosComunesApi.anularPago(pago.id, motivo.trim());
      toast.success("Pago anulado. El monto volvió a quedar pendiente.");
      setAnulando(false);
      setMotivo("");
      onAnulado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={clsx("text-sm font-medium text-slate-800 dark:text-slate-100", anulado && "text-slate-400 line-through dark:text-slate-500")}>
            {formatMonto(pago.monto)}
            <span className="font-normal text-slate-500 dark:text-slate-400">
              {" "}
              · {MEDIO_PAGO_LABEL[pago.medio]}
              {pago.referencia ? ` N° ${pago.referencia}` : ""}
            </span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pagado el {formatFecha(pago.fechaPago)}
            {pago.registradoPor ? ` · Registró ${pago.registradoPor.nombre} ${pago.registradoPor.apellido}` : ""}
          </p>
          {anulado && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-300">
              Anulado{pago.anuladoPor ? ` por ${pago.anuladoPor.nombre} ${pago.anuladoPor.apellido}` : ""}: {pago.motivoAnulacion}
            </p>
          )}
        </div>
        {anulado ? (
          <Badge tone="slate">Anulado</Badge>
        ) : (
          esAdmin &&
          !anulando && (
            <Button size="sm" variant="ghost" className="whitespace-nowrap max-sm:min-h-11" onClick={() => setAnulando(true)}>
              <Prohibit size={14} aria-hidden /> Anular
            </Button>
          )
        )}
      </div>
      {anulando && !anulado && (
        <form onSubmit={anular} className="mt-2 space-y-2">
          <Label htmlFor={`campo-anular-${pago.id}`}>¿Por qué se anula este pago?</Label>
          <Textarea
            id={`campo-anular-${pago.id}`}
            rows={2}
            required
            minLength={5}
            maxLength={300}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: se registró dos veces"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">El pago queda a la vista como anulado y el monto vuelve a quedar pendiente.</p>
          {error && <Alert tone="red">{error}</Alert>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAnulando(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" size="sm" loading={enviando}>
              Anular pago
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

// Detalle de un cobro: cuanto le toca a la unidad, en que se gasto y sus pagos.
// La administracion puede registrar y anular pagos desde aqui.
export function ModalCobro({
  id,
  esAdmin = false,
  iniciarEnPago = false,
  onClose,
  onActualizado,
}: {
  id: string;
  esAdmin?: boolean;
  iniciarEnPago?: boolean;
  onClose: () => void;
  onActualizado?: () => void;
}) {
  const { data: cobro, cargando, error, recargar } = useAsync(() => gastosComunesApi.cobro(id), [id]);
  const [pagando, setPagando] = useState(iniciarEnPago);

  function trasCambio() {
    recargar();
    onActualizado?.();
  }

  const titulo = cobro ? `Gasto común de ${nombrePeriodo(cobro.periodo.anio, cobro.periodo.mes)}` : "Gasto común";

  return (
    <Modal open onClose={onClose} title={titulo}>
      {cargando && !cobro ? (
        <Spinner />
      ) : error || !cobro ? (
        <Alert tone="red">{error ?? "No se pudo cargar el cobro."}</Alert>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <EstadoCobroBadge estado={cobro.estado} />
            <span className="text-sm text-slate-500 dark:text-slate-400">Vence el {fechaLarga(cobro.periodo.fechaVencimiento)}</span>
          </div>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-3">
              <Dato etiqueta="Unidad">
                {nombreUnidad(cobro.departamento)}
                {esAdmin && (
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{nombresResidentes(cobro.departamento.residentes)}</span>
                )}
              </Dato>
            </div>
            <Dato etiqueta="Gasto común">{formatMonto(cobro.montoGastoComun)}</Dato>
            <Dato etiqueta={`Fondo de reserva (${cobro.periodo.porcentajeFondoReserva}\u00a0%)`}>{formatMonto(cobro.montoFondoReserva)}</Dato>
            <Dato etiqueta="Total del mes">{formatMonto(cobro.montoTotal)}</Dato>
            <Dato etiqueta="Pagado">{formatMonto(cobro.montoPagado)}</Dato>
            <Dato etiqueta="Saldo" destacado>
              <span className={cobro.saldo > 0 ? (cobro.estado === "VENCIDO" ? "text-red-600 dark:text-red-300" : "") : "text-emerald-600 dark:text-emerald-300"}>
                {formatMonto(cobro.saldo)}
              </span>
            </Dato>
          </dl>

          {esAdmin && cobro.saldo > 0 && (
            pagando ? (
              <FormularioPago
                cobro={cobro}
                onCancelar={() => setPagando(false)}
                onListo={() => {
                  onActualizado?.();
                  onClose();
                }}
              />
            ) : (
              <Button className="w-full sm:w-auto" onClick={() => setPagando(true)}>
                <Receipt size={16} aria-hidden /> Registrar pago
              </Button>
            )
          )}

          {!esAdmin && cobro.saldo > 0 && cobro.periodo.instruccionesPago && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40">
              <p className="font-medium text-slate-800 dark:text-slate-100">Cómo pagar</p>
              <p className="mt-1 whitespace-pre-line text-slate-600 dark:text-slate-300">{cobro.periodo.instruccionesPago}</p>
            </div>
          )}

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Pagos</h4>
            {cobro.pagos.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Aún no hay pagos registrados para este mes.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-700/60 dark:border-slate-700">
                {cobro.pagos.map((p) => (
                  <FilaPago key={p.id} pago={p} esAdmin={esAdmin} onAnulado={trasCambio} />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">En qué se gastó</h4>
            <ListaPartidas partidas={cobro.periodo.partidas} total={cobro.periodo.totalGastos} />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {cobro.periodo.metodoProrrateo === "ALICUOTA"
                ? "El total se repartió entre las unidades según la alícuota de cada una."
                : "El total se repartió en partes iguales entre las unidades."}
              {cobro.periodo.porcentajeFondoReserva > 0
                ? ` A cada unidad se le suma un ${cobro.periodo.porcentajeFondoReserva}\u00a0% para el fondo común de reserva.`
                : ""}
            </p>
          </section>
        </div>
      )}
    </Modal>
  );
}
