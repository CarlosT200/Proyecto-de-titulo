import { CalendarPlus, Clock, MapPin } from "@phosphor-icons/react";
import { Button, Modal } from "./ui";
import { CheckAnimado } from "./Celebracion";
import { fechaConDia } from "../lib/reservas";
import { useToast } from "../context/ToastContext";

export interface DatosReservaConfirmada {
  id: string;
  espacio: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  condominio?: string;
}

// Archivo .ics (calendario) con la reserva. La hora va "flotante" (sin zona): el celular la toma como
// hora local, que es la del condominio. En el iPhone se abre la opcion "Agregar al calendario".
function archivoCalendario(r: DatosReservaConfirmada): string {
  const fecha = r.fecha.replace(/-/g, "");
  const hora = (h: string) => `${h.replace(":", "")}00`;
  const marca = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escapar = (s: string) => s.replace(/([,;\\])/g, "\\$1");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HabitaSmart//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${r.id}@habitasmart`,
    `DTSTAMP:${marca}`,
    `DTSTART:${fecha}T${hora(r.horaInicio)}`,
    `DTEND:${fecha}T${hora(r.horaFin)}`,
    `SUMMARY:${escapar(`Reserva: ${r.espacio}`)}`,
    r.condominio ? `LOCATION:${escapar(r.condominio)}` : "",
    "DESCRIPTION:Reserva confirmada en HabitaSmart.",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tu reserva comienza en una hora",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

// Momento de logro al reservar: el check se dibuja y la reserva aparece como una entrada (ticket).
export function ModalReservaConfirmada({ reserva, onClose }: { reserva: DatosReservaConfirmada | null; onClose: () => void }) {
  const toast = useToast();

  function agregarAlCalendario() {
    if (!reserva) return;
    const blob = new Blob([archivoCalendario(reserva)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `reserva-${reserva.espacio.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-")}-${reserva.fecha}.ics`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast.info("Abre el archivo descargado para agregarla a tu calendario.");
  }

  return (
    <Modal open={reserva !== null} onClose={onClose} title="Reserva confirmada">
      {reserva && (
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckAnimado size={72} />
          <div>
            <p className="font-display text-xl font-bold text-slate-900 dark:text-white">¡Listo, quedó reservado!</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Te esperamos. Si no puedes ir, cancélala para que otro vecino lo use.</p>
          </div>

          {/* La "entrada": dos partes separadas por una linea punteada con muescas a los lados. */}
          <div className="relative w-full overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white text-left dark:border-brand-500/30 dark:from-brand-500/10 dark:to-slate-800">
            <div className="px-5 pb-4 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Espacio común</p>
              <p className="mt-0.5 flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
                <MapPin size={18} weight="fill" className="shrink-0 text-accent-600 dark:text-accent-400" aria-hidden />
                {reserva.espacio}
              </p>
            </div>
            <div className="relative border-t-2 border-dashed border-brand-200 dark:border-brand-500/30">
              <span aria-hidden className="absolute -left-3 -top-3 h-6 w-6 rounded-full border border-brand-200 bg-white dark:border-brand-500/30 dark:bg-slate-800" />
              <span aria-hidden className="absolute -right-3 -top-3 h-6 w-6 rounded-full border border-brand-200 bg-white dark:border-brand-500/30 dark:bg-slate-800" />
            </div>
            <div className="grid grid-cols-2 gap-3 px-5 pb-5 pt-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Día</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{fechaConDia(reserva.fecha)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Horario</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                  <Clock size={16} className="text-brand-600 dark:text-brand-300" aria-hidden />
                  {reserva.horaInicio} a {reserva.horaFin}
                </p>
              </div>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="secondary" className="min-h-11" onClick={agregarAlCalendario}>
              <CalendarPlus size={18} aria-hidden /> Agregar a mi calendario
            </Button>
            <Button className="min-h-11" onClick={onClose}>
              Listo
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
