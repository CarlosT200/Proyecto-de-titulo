import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { condominioApi, reservasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { CalendarBlank } from "@phosphor-icons/react";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Label, PageHeader, Select, Spinner, staggerFade } from "../../components/ui";
import { formatFecha, hoyLocal, reservaFinalizada } from "../../lib/format";
import { ESTADO_RESERVA_LABEL, ESTADO_RESERVA_TONO } from "../../lib/badges";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

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

  useEffect(() => {
    if (!espacioComunId || !fecha) return;
    reservasApi.disponibilidad(espacioComunId, fecha).then((res) => setOcupados(res.horariosOcupados));
  }, [espacioComunId, fecha]);

  const espacioSeleccionado = espacios?.find((e) => e.id === espacioComunId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await reservasApi.crear({ espacioComunId, fecha, horaInicio, horaFin });
      toast.success("Reserva confirmada.");
      recargarReservas();
      reservasApi.disponibilidad(espacioComunId, fecha).then((res) => setOcupados(res.horariosOcupados));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarBlank} title="Reservar espacios comunes" subtitle="Consulta disponibilidad y reserva." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 h-fit">
          <CardHeader title="Nueva reserva" />
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
            <div>
              <Label htmlFor="campo-reservas-2">Fecha</Label>
              <Input id="campo-reservas-2"
                type="date"
                required
                min={hoyLocal()}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
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
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 p-3 text-xs text-slate-600 dark:text-slate-300">
                <p className="mb-1 font-medium">Horarios ya reservados para esa fecha:</p>
                {ocupados.length === 0 ? (
                  <p>Sin reservas para este día.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {ocupados.map((o, idx) => (
                      <li key={idx}>
                        {o.horaInicio} - {o.horaFin}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {error && <Alert tone="red">{error}</Alert>}

            <Button type="submit" className="w-full" loading={enviando}>
              Confirmar reserva
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Mis reservas" />
          {cargandoReservas ? (
            <Spinner />
          ) : !misReservas?.length ? (
            <EmptyState title="Aún no tienes reservas" />
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {misReservas.map((r, i) => {
                const finalizada = reservaFinalizada(r);
                const estado = finalizada ? "FINALIZADA" : r.estado;
                return (
                  <motion.div key={r.id} {...staggerFade(i)} className="px-5 py-3 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{r.espacioComun.nombre}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatFecha(r.fecha)} · {r.horaInicio} - {r.horaFin}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <Badge tone={ESTADO_RESERVA_TONO[estado]}>{ESTADO_RESERVA_LABEL[estado]}</Badge>
                      {r.estado === "CONFIRMADA" && !finalizada && (
                        <button
                          className="text-xs text-red-600 dark:text-red-400 hover:underline max-sm:min-h-11 max-sm:px-3"
                          onClick={async () => {
                            const ok = await confirmar(`¿Cancelar tu reserva de ${r.espacioComun.nombre}?`, {
                              titulo: "Cancelar reserva",
                              textoConfirmar: "Cancelar reserva",
                            });
                            if (!ok) return;
                            await reservasApi.cancelar(r.id);
                            toast.info("Reserva cancelada.");
                            recargarReservas();
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
