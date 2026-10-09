import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import {
  ChartPieSlice,
  CheckCircle,
  Coins,
  ListBullets,
  Percent,
  Plus,
  Receipt,
  Trash,
  Wallet,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { gastosComunesApi } from "../../api/endpoints";
import { mensajeError } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useFiltroUrl } from "../../hooks/useFiltroUrl";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import {
  Alert,
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
  Textarea,
} from "../../components/ui";
import { Cifra } from "../../components/Cifra";
import { BarraAvance, EstadoCobroBadge, ListaPartidas, ModalCobro } from "../../components/GastosComunes";
import { formatMonto, hoyLocal } from "../../lib/format";
import { METODO_PRORRATEO_LABEL } from "../../lib/badges";
import { MESES, fechaIso, fechaLarga, nombrePeriodo, nombreUnidad, nombresResidentes, porcentaje, tituloPeriodo } from "../../lib/gastosComunes";
import type { AlicuotasGastoComun, MetodoProrrateo, PeriodoGastoComun, PeriodoGastoComunDetalle } from "../../types";

const VISTAS = ["cobros", "atrasadas"] as const;
const ESTADOS = ["PENDIENTE", "VENCIDO", "PAGADO"] as const;
const TOLERANCIA_ALICUOTAS = 0.01;

// ------------------------------------------------------------------
// Emitir el cobro de un mes
// ------------------------------------------------------------------

interface FilaPartida {
  clave: number;
  concepto: string;
  monto: string;
}

let siguienteClave = 1;
const nuevaFila = (concepto = "", monto = ""): FilaPartida => ({ clave: siguienteClave++, concepto, monto });

function mesSiguiente(anio: number, mes: number) {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
}

// Vencimiento sugerido: el dia 10 del mes siguiente al cobrado (lo habitual), o en 10 dias si eso ya paso.
function vencimientoSugerido(anio: number, mes: number): string {
  const siguiente = mesSiguiente(anio, mes);
  const sugerido = fechaIso(siguiente.anio, siguiente.mes, 10);
  if (sugerido >= hoyLocal()) return sugerido;
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return fechaIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function ModalNuevoCobro({
  ultimo,
  onClose,
  onEmitido,
}: {
  ultimo: PeriodoGastoComun | null;
  onClose: () => void;
  onEmitido: (periodoId: string) => void;
}) {
  const toast = useToast();
  const hoy = new Date();
  const inicial = ultimo ? mesSiguiente(ultimo.anio, ultimo.mes) : { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };

  const [anio, setAnio] = useState(inicial.anio);
  const [mes, setMes] = useState(inicial.mes);
  const [vencimiento, setVencimiento] = useState(() => vencimientoSugerido(inicial.anio, inicial.mes));
  const [vencimientoEditado, setVencimientoEditado] = useState(false);
  const [metodo, setMetodo] = useState<MetodoProrrateo>(ultimo?.metodoProrrateo ?? "PARTES_IGUALES");
  const [fondo, setFondo] = useState(String(ultimo?.porcentajeFondoReserva ?? 5));
  const [filas, setFilas] = useState<FilaPartida[]>([nuevaFila()]);
  const [instrucciones, setInstrucciones] = useState(ultimo?.instruccionesPago ?? "");
  const [copiadoDe, setCopiadoDe] = useState<string | null>(null);
  const [editandoAlicuotas, setEditandoAlicuotas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: alicuotas, recargar: recargarAlicuotas } = useAsync(() => gastosComunesApi.alicuotas(), []);

  function elegirMes(nuevoAnio: number, nuevoMes: number) {
    setAnio(nuevoAnio);
    setMes(nuevoMes);
    if (!vencimientoEditado) setVencimiento(vencimientoSugerido(nuevoAnio, nuevoMes));
  }

  // Los gastos de un mes suelen repetirse: se copian los del ultimo mes para ajustar los montos.
  useEffect(() => {
    if (!ultimo) return;
    let vigente = true;
    gastosComunesApi
      .periodo(ultimo.id)
      .then((p) => {
        if (!vigente || p.partidas.length === 0) return;
        setFilas(p.partidas.map((x) => nuevaFila(x.concepto, String(x.monto))));
        setCopiadoDe(nombrePeriodo(p.anio, p.mes));
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [ultimo]);

  const unidades = alicuotas?.unidades.length ?? 0;
  const faltanAlicuotas = alicuotas ? alicuotas.unidades.filter((u) => !u.alicuota).length : 0;
  const alicuotasListas = Boolean(alicuotas) && unidades > 0 && faltanAlicuotas === 0 && Math.abs((alicuotas?.suma ?? 0) - 100) <= TOLERANCIA_ALICUOTAS;

  const totalGastos = filas.reduce((s, f) => s + (Number.isInteger(Number(f.monto)) && Number(f.monto) > 0 ? Number(f.monto) : 0), 0);
  const porcentajeFondo = Number.isInteger(Number(fondo)) ? Math.min(Math.max(Number(fondo), 0), 100) : 0;
  const totalFondo = Math.round((totalGastos * porcentajeFondo) / 100);

  function actualizarFila(clave: number, cambios: Partial<FilaPartida>) {
    setFilas((actuales) => actuales.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));
  }

  async function emitir(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const partidas = filas.map((f) => ({ concepto: f.concepto.trim(), monto: Number(f.monto) }));
    if (partidas.some((p) => p.concepto.length < 2)) return setError("Describe cada gasto (al menos 2 letras).");
    if (partidas.some((p) => !Number.isInteger(p.monto) || p.monto <= 0)) return setError("Cada gasto necesita un monto en pesos, sin decimales.");
    if (!Number.isInteger(Number(fondo)) || Number(fondo) < 0 || Number(fondo) > 100) return setError("El fondo de reserva debe ser un porcentaje entero entre 0 y 100.");
    if (metodo === "ALICUOTA" && !alicuotasListas) return setError("Para repartir según alícuota, primero completa las alícuotas para que sumen 100 %.");

    setEnviando(true);
    try {
      const r = await gastosComunesApi.emitir({
        anio,
        mes,
        fechaVencimiento: vencimiento,
        metodoProrrateo: metodo,
        porcentajeFondoReserva: Number(fondo),
        partidas,
        instruccionesPago: instrucciones.trim() || undefined,
      });
      toast.success(`Cobro de ${r.nombre} emitido para ${r.unidades} ${r.unidades === 1 ? "unidad" : "unidades"}. Se avisó a los residentes.`);
      onEmitido(r.id);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  const anios = [...new Set([hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1, inicial.anio])].sort();

  return (
    <Modal open onClose={onClose} title="Nuevo cobro mensual">
      <form onSubmit={emitir} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="campo-cobro-mes">Mes</Label>
            <Select id="campo-cobro-mes" value={mes} onChange={(e) => elegirMes(anio, Number(e.target.value))}>
              {MESES.map((nombre, i) => (
                <option key={nombre} value={i + 1}>
                  {nombre.charAt(0).toUpperCase() + nombre.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="campo-cobro-anio">Año</Label>
            <Select id="campo-cobro-anio" value={anio} onChange={(e) => elegirMes(Number(e.target.value), mes)}>
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="campo-cobro-vence">Vence el</Label>
            <Input id="campo-cobro-vence" type="date" required min={hoyLocal()} value={vencimiento} onChange={(e) => {
                setVencimiento(e.target.value);
                setVencimientoEditado(true);
              }}
            />
          </div>
          <div>
            <Label htmlFor="campo-cobro-fondo">Fondo de reserva (%)</Label>
            <Input
              id="campo-cobro-fondo"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              required
              value={fondo}
              onChange={(e) => setFondo(e.target.value)}
            />
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Cómo se reparte entre las unidades</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["PARTES_IGUALES", "ALICUOTA"] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                aria-pressed={metodo === valor}
                onClick={() => setMetodo(valor)}
                className={clsx(
                  "flex min-h-11 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors",
                  metodo === valor
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                )}
              >
                {METODO_PRORRATEO_LABEL[valor]}
              </button>
            ))}
          </div>
          {metodo === "ALICUOTA" && alicuotas && !alicuotasListas && (
            <div className="mt-2 space-y-2">
              <Alert tone="amber">
                {faltanAlicuotas > 0
                  ? `Faltan las alícuotas de ${faltanAlicuotas} de ${unidades} unidades.`
                  : `Las alícuotas suman ${alicuotas.suma.toLocaleString("es-CL")} % y deben sumar 100 %.`}
              </Alert>
              <Button type="button" size="sm" variant="secondary" onClick={() => setEditandoAlicuotas(true)}>
                <Percent size={14} aria-hidden /> Completar alícuotas
              </Button>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Gastos del mes</legend>
          {copiadoDe && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Se copiaron los gastos de {copiadoDe}: revisa y ajusta los montos.</p>
          )}
          {filas.map((f, i) => (
            // En celular la descripcion va en su propia linea (al lado del monto quedaba muy angosta).
            <div
              key={f.clave}
              className="flex flex-wrap items-start gap-2 border-b border-slate-100 pb-2 last-of-type:border-0 sm:flex-nowrap sm:border-0 sm:pb-0 dark:border-slate-700/60"
            >
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <Input
                  aria-label={`Descripción del gasto ${i + 1}`}
                  required
                  maxLength={80}
                  value={f.concepto}
                  onChange={(e) => actualizarFila(f.clave, { concepto: e.target.value })}
                  placeholder="Ej: Remuneraciones"
                />
              </div>
              <div className="min-w-0 flex-1 sm:w-36 sm:flex-none">
                <Input
                  aria-label={`Monto del gasto ${i + 1}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  required
                  value={f.monto}
                  onChange={(e) => actualizarFila(f.clave, { monto: e.target.value })}
                  placeholder="Monto"
                />
              </div>
              <button
                type="button"
                onClick={() => setFilas((actuales) => actuales.filter((x) => x.clave !== f.clave))}
                disabled={filas.length === 1}
                aria-label={`Quitar el gasto ${i + 1}`}
                className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-30 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <Button type="button" size="sm" variant="secondary" onClick={() => setFilas((actuales) => [...actuales, nuevaFila()])} disabled={filas.length >= 40}>
            <Plus size={14} aria-hidden /> Agregar gasto
          </Button>
        </fieldset>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-300">Gastos del mes</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{formatMonto(totalGastos)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-300">Fondo de reserva ({porcentajeFondo}&nbsp;%)</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{formatMonto(totalFondo)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-4 border-t border-slate-200 pt-1 font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
            <span>Total a cobrar</span>
            <span>{formatMonto(totalGastos + totalFondo)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            La aplicación no suma IVA ni otros impuestos: el total es la suma de los gastos más el fondo de reserva.
          </p>
          {unidades > 0 && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {unidades} {unidades === 1 ? "unidad" : "unidades"}
              {metodo === "PARTES_IGUALES" && totalGastos > 0
                ? ` · cerca de ${formatMonto(Math.round((totalGastos + totalFondo) / unidades))} cada una`
                : metodo === "ALICUOTA"
                  ? " · cada una paga según su alícuota"
                  : ""}
            </p>
          )}
          {alicuotas && unidades === 0 && (
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">El condominio no tiene unidades. Agrégalas en Condominio antes de emitir.</p>
          )}
        </div>

        <div>
          <Label htmlFor="campo-cobro-instrucciones">Cómo pagar (opcional)</Label>
          <Textarea
            id="campo-cobro-instrucciones"
            rows={3}
            maxLength={500}
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            placeholder="Ej: transferencia a la cuenta de la comunidad indicando el número de departamento."
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Los residentes lo ven junto a su saldo.</p>
        </div>

        {error && <Alert tone="red">{error}</Alert>}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Al emitir, cada residente recibe un aviso con el monto de su unidad. Podrás eliminar el cobro mientras no tenga pagos.
        </p>
        <Button type="submit" className="w-full" loading={enviando} disabled={unidades === 0}>
          Emitir cobro de {nombrePeriodo(anio, mes)}
        </Button>
      </form>
      {editandoAlicuotas && (
        <ModalAlicuotas
          onClose={() => {
            setEditandoAlicuotas(false);
            recargarAlicuotas();
          }}
        />
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------
// Alicuotas (porcentaje de cada unidad)
// ------------------------------------------------------------------

function ModalAlicuotas({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { data, cargando, error } = useAsync(() => gastosComunesApi.alicuotas(), []);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  useEffect(() => {
    if (data) setValores(Object.fromEntries(data.unidades.map((u) => [u.id, u.alicuota === null ? "" : String(u.alicuota)])));
  }, [data]);

  const suma = Object.values(valores).reduce((s, v) => s + (Number(v) > 0 ? Number(v) : 0), 0);
  const sumaRedondeada = Math.round(suma * 10000) / 10000;
  const cuadra = Math.abs(suma - 100) <= TOLERANCIA_ALICUOTAS;

  function repartirIgual(unidades: AlicuotasGastoComun["unidades"]) {
    const n = unidades.length;
    const base = Math.floor((100 / n) * 10000) / 10000;
    const primera = Math.round((100 - base * (n - 1)) * 10000) / 10000;
    setValores(Object.fromEntries(unidades.map((u, i) => [u.id, String(i === 0 ? primera : base)])));
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setErrorGuardar(null);
    const alicuotas = data.unidades.map((u) => {
      const texto = (valores[u.id] ?? "").replace(",", ".").trim();
      return { departamentoId: u.id, alicuota: texto === "" ? null : Number(texto) };
    });
    if (alicuotas.some((a) => a.alicuota !== null && (!Number.isFinite(a.alicuota) || a.alicuota <= 0 || a.alicuota > 100))) {
      return setErrorGuardar("Cada alícuota debe ser un número mayor que 0 y hasta 100.");
    }
    setEnviando(true);
    try {
      await gastosComunesApi.guardarAlicuotas(alicuotas);
      toast.success("Alícuotas guardadas.");
      onClose();
    } catch (err) {
      setErrorGuardar(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Alícuotas de las unidades">
      {cargando && !data ? (
        <Spinner />
      ) : error || !data ? (
        <Alert tone="red">{error ?? "No se pudieron cargar las unidades."}</Alert>
      ) : data.unidades.length === 0 ? (
        <EmptyState icon={Percent} title="No hay unidades registradas" description="Agrégalas en Condominio." />
      ) : (
        <form onSubmit={guardar} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Porcentaje de los gastos comunes que paga cada unidad, según el reglamento de copropiedad. Entre todas deben sumar 100 %.
            Solo se usan si el cobro se reparte según alícuota.
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={() => repartirIgual(data.unidades)}>
            Repartir en partes iguales
          </Button>
          <ul className="max-h-[45vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-700/60 dark:border-slate-700">
            {data.unidades.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <label htmlFor={`campo-alicuota-${u.id}`} className="text-sm text-slate-700 dark:text-slate-200">
                  {nombreUnidad(u)}
                </label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id={`campo-alicuota-${u.id}`}
                    className="w-28 text-right"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.0001"
                    value={valores[u.id] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [u.id]: e.target.value }))}
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400">%</span>
                </div>
              </li>
            ))}
          </ul>
          <p
            className={clsx(
              "flex items-center gap-1.5 text-sm font-medium",
              cuadra ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
            )}
          >
            {cuadra ? <CheckCircle size={16} weight="fill" aria-hidden /> : <WarningCircle size={16} weight="fill" aria-hidden />}
            Suman {sumaRedondeada.toLocaleString("es-CL", { maximumFractionDigits: 4 })} %
            {cuadra ? "" : " (deben sumar 100 %)"}
          </p>
          {errorGuardar && <Alert tone="red">{errorGuardar}</Alert>}
          <Button type="submit" className="w-full" loading={enviando}>
            Guardar alícuotas
          </Button>
        </form>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------
// Pagina
// ------------------------------------------------------------------

function Pestana({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={clsx(
        "flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
        activa
          ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-white"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

export default function AdminGastosComunes() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [params, setParams] = useSearchParams();
  const [vistaUrl, setVista] = useFiltroUrl("vista", VISTAS);
  const vista = vistaUrl || "cobros";
  const [estado, setEstado] = useFiltroUrl("estado", ESTADOS);
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<"nuevo" | "alicuotas" | "gastos" | null>(null);
  const [pagarDirecto, setPagarDirecto] = useState(false);
  const [nuevoPeriodo, setNuevoPeriodo] = useState(false);

  const periodos = useAsync(() => gastosComunesApi.periodos(), []);
  const morosidad = useAsync(() => gastosComunesApi.morosidad(), []);

  const periodoUrl = params.get("mes");
  const periodoId = periodos.data?.some((p) => p.id === periodoUrl) ? periodoUrl : (periodos.data?.[0]?.id ?? null);
  const detalle = useAsync<PeriodoGastoComunDetalle | null>(
    () => (periodoId ? gastosComunesApi.periodo(periodoId) : Promise.resolve(null)),
    [periodoId]
  );
  const cobroAbierto = params.get("ver");

  function cambiarParam(nombre: string, valor: string | null) {
    setParams(
      (actuales) => {
        const siguientes = new URLSearchParams(actuales);
        if (valor) siguientes.set(nombre, valor);
        else siguientes.delete(nombre);
        return siguientes;
      },
      { replace: true }
    );
  }

  function abrirCobro(id: string, pagar = false) {
    setPagarDirecto(pagar);
    cambiarParam("ver", id);
  }

  function recargarTodo() {
    periodos.recargar();
    morosidad.recargar();
    detalle.recargar();
  }

  async function eliminarPeriodo(p: PeriodoGastoComunDetalle) {
    const nombre = nombrePeriodo(p.anio, p.mes);
    const ok = await confirmar(
      `¿Eliminar el cobro de ${nombre}? Se borran los cobros de todas las unidades y se avisa a los residentes. Esta acción no se puede deshacer.`,
      { titulo: "Eliminar cobro del mes", textoConfirmar: "Eliminar" }
    );
    if (!ok) return;
    try {
      await gastosComunesApi.eliminarPeriodo(p.id);
      toast.success(`Se eliminó el cobro de ${nombre}.`);
      periodos.setData((actuales) => actuales?.filter((x) => x.id !== p.id) ?? actuales);
      cambiarParam("mes", null);
      periodos.recargar();
      morosidad.recargar();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  }

  const ultimo = periodos.data?.[0] ?? null;
  const porCobrar = (periodos.data ?? []).reduce((s, p) => s + (p.totalCobrado - p.totalPagado), 0);
  const deudaVencida = (morosidad.data ?? []).reduce((s, u) => s + u.deuda, 0);
  const unidadesAtrasadas = morosidad.data?.length ?? 0;

  const cobrosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const prioridad: Record<string, number> = { VENCIDO: 0, PENDIENTE: 1, PAGADO: 2 };
    return (detalle.data?.cobros ?? [])
      .filter((c) => {
        if (estado && c.estado !== estado) return false;
        if (!texto) return true;
        return `${nombreUnidad(c.departamento)} ${nombresResidentes(c.departamento.residentes)}`.toLowerCase().includes(texto);
      })
      .sort(
        (a, b) =>
          (prioridad[a.estado] ?? 3) - (prioridad[b.estado] ?? 3) ||
          nombreUnidad(a.departamento).localeCompare(nombreUnidad(b.departamento), "es", { numeric: true })
      );
  }, [detalle.data, estado, busqueda]);

  const sinPeriodos = periodos.data?.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Gastos comunes"
        subtitle="Emite el cobro de cada mes, registra los pagos y revisa qué unidades están atrasadas."
        action={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button variant="secondary" onClick={() => setModal("alicuotas")}>
              <Percent size={16} aria-hidden /> Alícuotas
            </Button>
            <Button onClick={() => setModal("nuevo")} disabled={!periodos.data}>
              <Plus size={16} aria-hidden /> Nuevo cobro
            </Button>
          </div>
        }
      />

      {periodos.error && <Alert tone="red">{periodos.error}</Alert>}

      {periodos.data && !sinPeriodos && (
        <Card plana className="overflow-hidden">
          <div className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4 dark:bg-slate-700/60">
            <Cifra icono={Coins} etiqueta="Por cobrar" valor={porCobrar > 0 ? formatMonto(porCobrar) : 0} detalle="saldo de todos los meses" />
            <Cifra
              icono={WarningCircle}
              etiqueta="Vencido"
              valor={deudaVencida > 0 ? formatMonto(deudaVencida) : 0}
              detalle="deuda ya vencida"
              alerta
              to={deudaVencida > 0 ? "/gastos-comunes?vista=atrasadas" : undefined}
            />
            <Cifra
              icono={Receipt}
              etiqueta="Atrasadas"
              valor={unidadesAtrasadas}
              detalle={unidadesAtrasadas === 1 ? "unidad con meses vencidos" : "unidades con meses vencidos"}
              alerta
              to={unidadesAtrasadas > 0 ? "/gastos-comunes?vista=atrasadas" : undefined}
            />
            <Cifra
              icono={ChartPieSlice}
              etiqueta="Recaudado"
              valor={ultimo ? `${porcentaje(ultimo.totalPagado, ultimo.totalCobrado)} %` : "Sin datos"}
              detalle={
                ultimo ? (
                  <>
                    <span className="mb-1.5 block">de {nombrePeriodo(ultimo.anio, ultimo.mes)}</span>
                    <BarraAvance pagado={ultimo.totalPagado} total={ultimo.totalCobrado} etiqueta={`Recaudado de ${nombrePeriodo(ultimo.anio, ultimo.mes)}`} />
                  </>
                ) : undefined
              }
            />
          </div>
        </Card>
      )}

      <div role="tablist" aria-label="Vista" className="inline-grid w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto dark:bg-slate-800">
        <Pestana activa={vista === "cobros"} onClick={() => setVista("")}>
          Cobros por mes
        </Pestana>
        <Pestana activa={vista === "atrasadas"} onClick={() => setVista("atrasadas")}>
          <span className="sm:hidden">Atrasadas</span>
          <span className="hidden sm:inline">Unidades atrasadas</span>
          {unidadesAtrasadas > 0 ? ` (${unidadesAtrasadas})` : ""}
        </Pestana>
      </div>

      {vista === "cobros" ? (
        <Card plana className="overflow-hidden">
          {periodos.cargando && !periodos.data ? (
            <Spinner />
          ) : sinPeriodos ? (
            <div className="p-5">
              <EmptyState
                icon={Wallet}
                title="Aún no hay cobros de gastos comunes"
                description="Emite el primero con «Nuevo cobro»: registras los gastos del mes y el sistema calcula lo que paga cada unidad."
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-5 dark:border-slate-700/60">
                <div className="w-full sm:w-52">
                  <Label htmlFor="campo-gastos-mes">Mes</Label>
                  <Select id="campo-gastos-mes" value={periodoId ?? ""} onChange={(e) => {
                      setNuevoPeriodo(false);
                      cambiarParam("mes", e.target.value);
                    }}>
                    {(periodos.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {tituloPeriodo(p.anio, p.mes)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-full sm:max-w-[16rem]">
                  <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por unidad o residente..." />
                </div>
                <div className="w-full sm:w-44">
                  <Select aria-label="Filtrar por estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
                    <option value="">Todos los estados</option>
                    <option value="PENDIENTE">Por pagar</option>
                    <option value="VENCIDO">Vencidos</option>
                    <option value="PAGADO">Pagados</option>
                  </Select>
                </div>
              </div>

              {detalle.data && (
                <div
                  key={detalle.data.id}
                  className={clsx("space-y-4 border-b border-slate-100 px-5 py-4 dark:border-slate-700/60", nuevoPeriodo && "animate-aparece")}
                >
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                      <span className="font-medium text-slate-900 dark:text-white">
                        Recaudado {formatMonto(detalle.data.cobros.reduce((s, c) => s + c.montoPagado, 0))} de{" "}
                        {formatMonto(detalle.data.cobros.reduce((s, c) => s + c.montoTotal, 0))}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {detalle.data.cobros.filter((c) => c.estado === "PAGADO").length} de {detalle.data.cobros.length} unidades al día
                      </span>
                    </div>
                    <BarraAvance
                      pagado={detalle.data.cobros.reduce((s, c) => s + c.montoPagado, 0)}
                      total={detalle.data.cobros.reduce((s, c) => s + c.montoTotal, 0)}
                      etiqueta={`Recaudado de ${nombrePeriodo(detalle.data.anio, detalle.data.mes)}`}
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-slate-600 dark:text-slate-300">Vence</dt>
                      <dd className="font-medium text-slate-900 dark:text-white">{fechaLarga(detalle.data.fechaVencimiento)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-600 dark:text-slate-300">Gastos del mes</dt>
                      <dd className="font-medium tabular-nums text-slate-900 dark:text-white">{formatMonto(detalle.data.totalGastos)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-600 dark:text-slate-300">Fondo de reserva</dt>
                      <dd className="font-medium text-slate-900 dark:text-white">{detalle.data.porcentajeFondoReserva}&nbsp;%</dd>
                    </div>
                    <div>
                      <dt className="text-slate-600 dark:text-slate-300">Reparto</dt>
                      <dd className="font-medium text-slate-900 dark:text-white">{METODO_PRORRATEO_LABEL[detalle.data.metodoProrrateo]}</dd>
                    </div>
                  </dl>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Button size="sm" variant="secondary" className="max-sm:min-h-11" onClick={() => setModal("gastos")}>
                      <ListBullets size={14} aria-hidden /> Gastos del mes
                    </Button>
                    {detalle.data.puedeEliminar && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-red-700 max-sm:min-h-11 dark:text-red-300"
                        onClick={() => eliminarPeriodo(detalle.data!)}
                      >
                        <Trash size={14} aria-hidden /> Eliminar mes
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {detalle.error ? (
                <div className="p-5">
                  <Alert tone="red">{detalle.error}</Alert>
                </div>
              ) : detalle.cargando && !detalle.data ? (
                <Spinner />
              ) : cobrosFiltrados.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No hay cobros que coincidan" description="Prueba con otro estado o búsqueda." />
                </div>
              ) : (
                <>
                  <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                    Primero los vencidos, luego los por pagar y al final los pagados.
                  </p>
                  {/* Celular y tablet: tarjetas (dos columnas desde 640 px). Desde 1280 px: tabla. */}
                  <ul className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:hidden dark:bg-slate-700/60">
                    {cobrosFiltrados.map((c) => (
                      <li key={c.id} className="flex flex-col gap-3 bg-white px-5 py-4 dark:bg-slate-800 sm:[&:last-child:nth-child(odd)]:col-span-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white">{nombreUnidad(c.departamento)}</p>
                            <p className="break-words text-sm text-slate-600 dark:text-slate-300">{nombresResidentes(c.departamento.residentes)}</p>
                          </div>
                          <EstadoCobroBadge estado={c.estado} />
                        </div>
                        <div>
                          <p className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                            <span className="text-slate-600 dark:text-slate-300">
                              Saldo{" "}
                              <span
                                className={clsx(
                                  "font-display text-lg font-bold tabular-nums",
                                  c.saldo === 0 ? "text-emerald-700 dark:text-emerald-300" : c.estado === "VENCIDO" ? "text-red-700 dark:text-red-300" : "text-slate-900 dark:text-white"
                                )}
                              >
                                {formatMonto(c.saldo)}
                              </span>
                            </span>
                            <span className="tabular-nums text-slate-600 dark:text-slate-300">de {formatMonto(c.montoTotal)}</span>
                          </p>
                          <BarraAvance pagado={c.montoPagado} total={c.montoTotal} etiqueta={`Pagado de ${nombreUnidad(c.departamento)}`} />
                        </div>
                        <div className={clsx("mt-auto grid gap-2", c.saldo > 0 ? "grid-cols-2" : "grid-cols-1")}>
                          {c.saldo > 0 && (
                            <Button size="sm" className="min-h-11" onClick={() => abrirCobro(c.id, true)}>
                              <Receipt size={14} aria-hidden /> Registrar pago
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" className="min-h-11" onClick={() => abrirCobro(c.id)}>
                            Ver detalle
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden overflow-x-auto xl:block">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-100 text-xs uppercase text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                        <tr>
                          <th scope="col" className="px-5 py-3">Unidad</th>
                          <th scope="col" className="px-5 py-3 text-right">Total</th>
                          <th scope="col" className="px-5 py-3 text-right">Pagado</th>
                          <th scope="col" className="px-5 py-3 text-right">Saldo</th>
                          <th scope="col" className="px-5 py-3">Estado</th>
                          <th scope="col" className="px-5 py-3">
                            <span className="sr-only">Acciones</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {cobrosFiltrados.map((c) => (
                          <tr key={c.id}>
                            <td className="px-5 py-3">
                              <span className="font-medium text-slate-900 dark:text-slate-100">{nombreUnidad(c.departamento)}</span>
                              <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{nombresResidentes(c.departamento.residentes)}</span>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{formatMonto(c.montoTotal)}</td>
                            <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatMonto(c.montoPagado)}</td>
                            <td
                              className={clsx(
                                "whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums",
                                c.saldo === 0 ? "text-emerald-700 dark:text-emerald-300" : c.estado === "VENCIDO" ? "text-red-700 dark:text-red-300" : "text-slate-900 dark:text-white"
                              )}
                            >
                              {formatMonto(c.saldo)}
                            </td>
                            <td className="px-5 py-3">
                              <EstadoCobroBadge estado={c.estado} />
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                {c.saldo > 0 && (
                                  <Button size="sm" className="whitespace-nowrap" onClick={() => abrirCobro(c.id, true)}>
                                    <Receipt size={14} aria-hidden /> Registrar pago
                                  </Button>
                                )}
                                <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => abrirCobro(c.id)}>
                                  Ver detalle
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </Card>
      ) : (
        <Card plana className="overflow-hidden">
          {morosidad.cargando && !morosidad.data ? (
            <Spinner />
          ) : morosidad.error ? (
            <div className="p-5">
              <Alert tone="red">{morosidad.error}</Alert>
            </div>
          ) : unidadesAtrasadas === 0 ? (
            <div className="p-5">
              <EmptyState icon={CheckCircle} title="No hay unidades con deuda vencida" description="Todas las unidades están al día con los cobros ya vencidos." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {morosidad.data!.map((u) => (
                <li key={u.departamento.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">{nombreUnidad(u.departamento)}</p>
                      <p className="break-words text-sm text-slate-600 dark:text-slate-300">{nombresResidentes(u.departamento.residentes)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-bold tabular-nums text-red-700 dark:text-red-300">{formatMonto(u.deuda)}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {u.cobros.length === 1 ? "1 mes vencido" : `${u.cobros.length} meses vencidos`}
                      </p>
                    </div>
                  </div>
                  {/* Cada mes vencido como una linea con su accion, sin recuadros dentro del recuadro. */}
                  <ul className="mt-3 divide-y divide-slate-100 border-l-2 border-red-200 pl-3 dark:divide-slate-700/60 dark:border-red-500/40">
                    {u.cobros.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2">
                        <p className="text-sm">
                          <span className="font-medium text-slate-900 dark:text-slate-100">{tituloPeriodo(c.periodo.anio, c.periodo.mes)}</span>
                          <span className="text-slate-600 dark:text-slate-300"> · venció el {fechaLarga(c.periodo.fechaVencimiento)}</span>
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{formatMonto(c.saldo)}</span>
                          <Button size="sm" className="max-sm:min-h-11" onClick={() => abrirCobro(c.id, true)}>
                            Registrar pago
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {modal === "nuevo" && (
        <ModalNuevoCobro
          ultimo={ultimo}
          onClose={() => setModal(null)}
          onEmitido={(id) => {
            setModal(null);
            // vista y mes en un solo cambio de la direccion: dos cambios seguidos se pisan
            setParams(
              (actuales) => {
                const siguientes = new URLSearchParams(actuales);
                siguientes.delete("vista");
                siguientes.set("mes", id);
                return siguientes;
              },
              { replace: true }
            );
            setNuevoPeriodo(true);
            periodos.recargar();
          }}
        />
      )}
      {modal === "alicuotas" && <ModalAlicuotas onClose={() => setModal(null)} />}
      {modal === "gastos" && detalle.data && (
        <Modal open onClose={() => setModal(null)} title={`Gastos de ${nombrePeriodo(detalle.data.anio, detalle.data.mes)}`}>
          <div className="space-y-4">
            <ListaPartidas partidas={detalle.data.partidas} total={detalle.data.totalGastos} />
            {detalle.data.instruccionesPago && (
              <div className="text-sm">
                <p className="font-medium text-slate-800 dark:text-slate-100">Cómo pagar</p>
                <p className="mt-1 whitespace-pre-line text-slate-600 dark:text-slate-300">{detalle.data.instruccionesPago}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
      {cobroAbierto && (
        <ModalCobro
          id={cobroAbierto}
          esAdmin
          iniciarEnPago={pagarDirecto}
          onClose={() => {
            setPagarDirecto(false);
            cambiarParam("ver", null);
          }}
          onActualizado={recargarTodo}
        />
      )}
    </div>
  );
}
