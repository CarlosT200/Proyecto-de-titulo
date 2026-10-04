import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarBlank } from "@phosphor-icons/react";
import { reservasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, SearchInput, Spinner, staggerFade } from "../../components/ui";
import { formatFecha, reservaFinalizada } from "../../lib/format";
import { ESTADO_RESERVA_LABEL, ESTADO_RESERVA_TONO } from "../../lib/badges";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

export default function AdminReservas() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { data, cargando, error, recargar } = useAsync(() => reservasApi.listarTodas(), []);
  const [busqueda, setBusqueda] = useState("");

  const filtradas = (data ?? []).filter((r) => {
    const texto = `${r.espacioComun.nombre} ${r.usuario?.nombre ?? ""} ${r.usuario?.apellido ?? ""}`.toLowerCase();
    return !busqueda || texto.includes(busqueda.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarBlank} title="Reservas de espacios comunes" subtitle="Consulta de todas las reservas realizadas." />

      <SearchInput
        value={busqueda}
        onChange={setBusqueda}
        placeholder="Buscar por espacio o residente..."
        className="w-full sm:max-w-xs"
      />

      <Card>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState title="Aún no hay reservas registradas" />
        ) : !filtradas.length ? (
          <EmptyState title="Sin resultados" description="Ninguna reserva coincide con la búsqueda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla-movil w-full text-left text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-700/60 text-xs uppercase text-slate-400 dark:text-slate-500">
                <tr>
                  <th className="px-5 py-3">Espacio</th>
                  <th className="px-5 py-3">Residente</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Horario</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {filtradas.map((r, i) => {
                  const finalizada = reservaFinalizada(r);
                  const estado = finalizada ? "FINALIZADA" : r.estado;
                  return (
                    <motion.tr key={r.id} {...staggerFade(i)} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                      <td data-label="Espacio" className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{r.espacioComun.nombre}</td>
                      <td data-label="Residente" className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {r.usuario ? `${r.usuario.nombre} ${r.usuario.apellido}` : "—"}
                      </td>
                      <td data-label="Fecha" className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatFecha(r.fecha)}</td>
                      <td data-label="Horario" className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {r.horaInicio} - {r.horaFin}
                      </td>
                      <td data-label="Estado" className="px-5 py-3">
                        <Badge tone={ESTADO_RESERVA_TONO[estado]}>{ESTADO_RESERVA_LABEL[estado]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r.estado === "CONFIRMADA" && !finalizada && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const ok = await confirmar(`¿Cancelar la reserva de ${r.espacioComun.nombre}?`, {
                                titulo: "Cancelar reserva",
                                textoConfirmar: "Cancelar reserva",
                              });
                              if (!ok) return;
                              await reservasApi.cancelar(r.id);
                              toast.success("Reserva cancelada.");
                              recargar();
                            }}
                          >
                            Cancelar
                          </Button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
