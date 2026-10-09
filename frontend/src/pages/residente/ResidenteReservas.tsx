import { FormEvent, useEffect, useState } from "react";
import clsx from "clsx";
import { CalendarBlank, CalendarCheck } from "@phosphor-icons/react";
import { condominioApi, reservasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Label, PageHeader, Select, Spinner } from "../../components/ui";
import { BadgeEstadoReserva } from "../../components/Reservas";
import { CalendarioReservas, LineaDelDia } from "../../components/CalendarioReservas";
import { useAcercarAlAparecer } from "../../hooks/useAcercarAlAparecer";
import { usePulsoAlCambiar } from "../../hooks/usePulsoAlCambiar";
import { formatFecha, hoyLocal } from "../../lib/format";
import { avisoDeHorario, cuandoEs, esProxima, estadoVisible, fechaConDia, ordenarReservas } from "../../lib/reservas";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import type { Reserva } from "../../types";

const ANTERIORES_VISIBLES = 5;

// Una reserva en "Mis reservas". La recien confirmada entra con un movimiento corto y, si la lista quedo
// fuera de la pantalla (con una columna el formulario esta arriba), se acerca para confirmarlo.
function FilaReserva({ r, nueva, onCancelar }: { r: Reserva; nueva: boolean; onCancelar?: () => void }) {
  const ref = useAcercarAlAparecer<HTMLLIElement>(nueva, 1023);
  return (
    <li ref={ref} className={clsx("px-5 py-3", nueva && "animate-aparece")}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words text-sm font-medium text-slate-900 dark:text-slate-100">{r.espacioComun.nombre}</p>
        <BadgeEstadoReserva estado={estadoVisible(r)} />
      </div>
      <p className="mt-0.5 text-sm tabular-nums text-slate-600 dark:text-slate-300">
        {formatFecha(r.fecha)} · {r.horaInicio} - {r.horaFin}
      </p>
      {onCancelar && (
        <button
          type="button"
          onClick={onCancelar}
          className="-ml-2 mt-1 inline-flex items-center rounded-lg px-2 py-1 text-sm font-medium text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 max-sm:min-h-11 dark:text-red-400"
        >
          Cancelar reserva
        </button>
      )}
    </li>
  );
}

export default function ResidenteReservas() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { data: espacios } = useAsync(() => condominioApi.listarEspacios(true), []);
  const { data: misReservas, cargando: cargandoReservas, recargar: recargarReservas } = useAsync(
    () => reservasApi.mias(),
    []
  );

  const [espacioComunId, setEspacioComunId] = useState("");
  const [fecha, setFecha] = useState(hoyLocal());
  const [horaInicio, setHoraInicio] = useState("10:00");
  const [horaFin, setHoraFin] = useState("12:00");
  const [ocupados, setOcupados] = useState<{ horaInicio: string; horaFin: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // sube despues de reservar o cancelar para que el calendario vuelva a consultar la ocupacion
  const [versionCalendario, setVersionCalendario] = useState(0);
  const [verTodasLasAnteriores, setVerTodasLasAnteriores] = useState(false);
  const [nuevaId, setNuevaId] = useState<string | null>(null);

  useEffect(() => {
    if (!espacioComunId || !fecha) return;
    reservasApi.disponibilidad(espacioComunId, fecha).then((res) => setOcupados(res.horariosOcupados));
  }, [espacioComunId, fecha]);

  const espacioSeleccionado = espacios?.find((e) => e.id === espacioComunId);
  const aviso = avisoDeHorario(espacioSeleccionado, fecha, horaInicio, horaFin, ocupados);

  const ordenadas = ordenarReservas(misReservas ?? []);
  const proximas = ordenadas.filter(esProxima);
  const anteriores = ordenadas.filter((r) => !esProxima(r));
  const proxima = proximas[0];
  // La tarjeta de arriba se mueve solo cuando cambia la reserva mostrada (nueva, cancelada), no al cargar.
  const pulsoProxima = usePulsoAlCambiar(proxima?.id ?? "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const creada = await reservasApi.crear({ espacioComunId, fecha, horaInicio, horaFin });
      setNuevaId(creada.id);
      setVersionCalendario((v) => v + 1);
      toast.success("Reserva confirmada.");
      recargarReservas();
      reservasApi.disponibilidad(espacioComunId, fecha).then((res) => setOcupados(res.horariosOcupados));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  // Si la cancelacion falla se avisa (antes quedaba en silencio).
  async function cancelar(r: Reserva) {
    const ok = await confirmar(`¿Cancelar tu reserva de ${r.espacioComun.nombre}?`, {
      titulo: "Cancelar reserva",
      textoConfirmar: "Cancelar reserva",
      textoCancelar: "Volver",
    });
    if (!ok) return;
    try {
      await reservasApi.cancelar(r.id);
      toast.info("Reserva cancelada.");
      recargarReservas();
      setVersionCalendario((v) => v + 1);
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo cancelar la reserva."));
    }
  }

  const anterioresVisibles = verTodasLasAnteriores ? anteriores : anteriores.slice(0, ANTERIORES_VISIBLES);

  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarBlank} title="Reservar espacios comunes" subtitle="Consulta disponibilidad y reserva." />

      {/* Lo que mas se consulta: cuando es mi proxima reserva. */}
      {misReservas && (
        <Card plana>
          <div key={pulsoProxima} className={clsx("flex items-center gap-4 px-5 py-4", pulsoProxima > 0 && "animate-aparece")}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <CalendarCheck size={24} weight="duotone" aria-hidden />
            </span>
            {proxima ? (
              <div className="min-w-0">
                <h2 className="text-sm text-slate-600 dark:text-slate-300">Tu próxima reserva</h2>
                <p className="break-words font-display text-lg font-bold text-slate-900 dark:text-white">{proxima.espacioComun.nombre}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <Badge tone="blue">{cuandoEs(proxima.fecha)}</Badge>
                  <span>
                    {fechaConDia(proxima.fecha)} · <span className="tabular-nums">{proxima.horaInicio} - {proxima.horaFin}</span>
                  </span>
                </p>
              </div>
            ) : (
              <div className="min-w-0">
                <h2 className="font-medium text-slate-900 dark:text-white">No tienes reservas próximas</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">Elige un espacio abajo para reservar.</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card plana className="h-fit lg:col-span-2">
          <CardHeader nivel={2} title="Nueva reserva" />
          <form onSubmit={handleSubmit} className="space-y-3 p-5">
            <div>
              <Label htmlFor="campo-reservas-1">Espacio común</Label>
              <Select id="campo-reservas-1" required value={espacioComunId} onChange={(e) => setEspacioComunId(e.target.value)}>
                <option value="">Selecciona un espacio</option>
                {espacios?.map((esp) => (
                  <option key={esp.id} value={esp.id}>
                    {esp.nombre} ({esp.horarioInicio} - {esp.horarioFin})
                  </option>
                ))}
              </Select>
            </div>
            {espacioSeleccionado ? (
              <div>
                <p className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Día</span>
                  <span className="font-medium text-brand-700 dark:text-brand-300">{fechaConDia(fecha)}</span>
                </p>
                <CalendarioReservas espacio={espacioSeleccionado} fecha={fecha} onElegir={setFecha} version={versionCalendario} />
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                Elige un espacio para ver su calendario y qué días están libres.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="campo-reservas-3">Desde</Label>
                <Input id="campo-reservas-3" type="time" required value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="campo-reservas-4">Hasta</Label>
                <Input id="campo-reservas-4" type="time" required value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
              </div>
            </div>

            {espacioSeleccionado && (
              <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <p>
                  <span className="font-medium">{espacioSeleccionado.nombre}</span> se puede reservar de{" "}
                  <span className="font-medium tabular-nums">{espacioSeleccionado.horarioInicio}</span> a{" "}
                  <span className="font-medium tabular-nums">{espacioSeleccionado.horarioFin}</span>.
                </p>
                <LineaDelDia
                  espacio={espacioSeleccionado}
                  ocupados={ocupados}
                  horaInicio={horaInicio}
                  horaFin={horaFin}
                  conflicto={Boolean(aviso)}
                />
                <div>
                  <p className="mb-1.5 font-medium">Horarios ya reservados ese día</p>
                  {ocupados.length === 0 ? (
                    <p>Sin reservas: está libre todo su horario.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {ocupados.map((o, idx) => (
                        <li
                          key={idx}
                          className="rounded-full bg-white px-2.5 py-1 font-medium tabular-nums text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600"
                        >
                          {o.horaInicio} - {o.horaFin}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {aviso && <Alert tone="amber">{aviso}</Alert>}
            {error && <Alert tone="red">{error}</Alert>}

            <Button type="submit" className="w-full" loading={enviando}>
              Confirmar reserva
            </Button>
          </form>
        </Card>

        <Card plana className="h-fit">
          <CardHeader nivel={2} title="Mis reservas" />
          {cargandoReservas && !misReservas ? (
            <Spinner />
          ) : !misReservas?.length ? (
            <EmptyState title="Aún no tienes reservas" />
          ) : (
            <div>
              <h3 className="px-5 pt-4 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Próximas</h3>
              {proximas.length === 0 ? (
                <p className="px-5 py-3 text-sm text-slate-600 dark:text-slate-300">No tienes reservas próximas.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {proximas.map((r) => (
                    <FilaReserva key={r.id} r={r} nueva={r.id === nuevaId} onCancelar={() => cancelar(r)} />
                  ))}
                </ul>
              )}
              {anteriores.length > 0 && (
                <>
                  <h3 className="border-t border-slate-100 px-5 pt-4 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                    Anteriores
                  </h3>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">{anterioresVisibles.map((r) => (
                      <FilaReserva key={r.id} r={r} nueva={false} />
                    ))}</ul>
                  {anteriores.length > ANTERIORES_VISIBLES && (
                    <div className="border-t border-slate-100 px-5 py-2 dark:border-slate-700/60">
                      <button
                        type="button"
                        aria-expanded={verTodasLasAnteriores}
                        onClick={() => setVerTodasLasAnteriores((v) => !v)}
                        className="inline-flex items-center rounded text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:min-h-11 dark:text-brand-400"
                      >
                        {verTodasLasAnteriores ? "Ver menos" : `Ver todas (${anteriores.length})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
