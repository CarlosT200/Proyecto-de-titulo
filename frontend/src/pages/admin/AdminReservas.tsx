import { useMemo, useState } from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import { reservasApi } from "../../api/endpoints";
import { mensajeError } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";
import { useFiltroUrl } from "../../hooks/useFiltroUrl";
import { Alert, Button, Card, EmptyState, PageHeader, SearchInput, Select, Spinner } from "../../components/ui";
import { BadgeEstadoReserva } from "../../components/Reservas";
import { CeldaResumen } from "../../components/CeldaResumen";
import { formatFecha } from "../../lib/format";
import { esDeHoy, esProxima, estadoVisible, ordenarReservas } from "../../lib/reservas";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import type { Reserva } from "../../types";

const VISTAS = ["hoy", "proximas", "canceladas"] as const;

export default function AdminReservas() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { data, cargando, error, recargar } = useAsync(() => reservasApi.listarTodas(), []);
  const [busqueda, setBusqueda] = useState("");
  const [espacioId, setEspacioId] = useState("");
  const [vista, setVista] = useFiltroUrl("vista", VISTAS);

  // Espacios que aparecen en las reservas, para el filtro (sin repetir)
  const espacios = useMemo(() => {
    const mapa = new Map<string, string>();
    (data ?? []).forEach((r) => mapa.set(r.espacioComun.id, r.espacioComun.nombre));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [data]);

  const hoy = (data ?? []).filter(esDeHoy).length;
  const proximas = (data ?? []).filter(esProxima).length;
  const canceladas = (data ?? []).filter((r) => r.estado === "CANCELADA").length;

  const filtradas = ordenarReservas(
    (data ?? []).filter((r) => {
      const texto = `${r.espacioComun.nombre} ${r.usuario?.nombre ?? ""} ${r.usuario?.apellido ?? ""}`.toLowerCase();
      if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;
      if (espacioId && r.espacioComun.id !== espacioId) return false;
      if (vista === "hoy") return esDeHoy(r);
      if (vista === "proximas") return esProxima(r);
      if (vista === "canceladas") return r.estado === "CANCELADA";
      return true;
    })
  );
  const hayFiltros = Boolean(busqueda || espacioId || vista);

  // Si la cancelacion falla se avisa (antes quedaba en silencio y la reserva seguia como si nada).
  async function cancelar(r: Reserva) {
    const ok = await confirmar(`¿Cancelar la reserva de ${r.espacioComun.nombre}? El residente recibirá un aviso.`, {
      titulo: "Cancelar reserva",
      textoConfirmar: "Cancelar reserva",
      textoCancelar: "Volver",
    });
    if (!ok) return;
    try {
      await reservasApi.cancelar(r.id);
      toast.success("Reserva cancelada.");
      recargar();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo cancelar la reserva."));
    }
  }

  const puedeCancelar = (r: Reserva) => r.estado === "CONFIRMADA" && estadoVisible(r) !== "FINALIZADA";
  const nombreDe = (r: Reserva) => (r.usuario ? `${r.usuario.nombre} ${r.usuario.apellido}` : "—");

  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarBlank} title="Reservas de espacios comunes" subtitle="Consulta de todas las reservas realizadas." />

      {data && data.length > 0 && (
        <Card plana className="overflow-hidden">
          <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-700/60">
            <CeldaResumen titulo="Hoy" valor={hoy} detalle={hoy === 1 ? "reserva de hoy" : "reservas de hoy"} activa={vista === "hoy"} onToggle={() => setVista(vista === "hoy" ? "" : "hoy")} />
            <CeldaResumen titulo="Próximas" valor={proximas} detalle={proximas === 1 ? "confirmada por venir" : "confirmadas por venir"} activa={vista === "proximas"} onToggle={() => setVista(vista === "proximas" ? "" : "proximas")} />
            <CeldaResumen titulo="Canceladas" valor={canceladas} detalle="en total" activa={vista === "canceladas"} onToggle={() => setVista(vista === "canceladas" ? "" : "canceladas")} />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 items-center gap-3 sm:flex sm:flex-wrap">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por espacio o residente..." className="w-full sm:max-w-xs" />
        {espacios.length > 1 && (
          <Select aria-label="Filtrar por espacio" value={espacioId} onChange={(e) => setEspacioId(e.target.value)} className="w-full sm:w-52">
            <option value="">Todos los espacios</option>
            {espacios.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </Select>
        )}
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setEspacioId("");
              setVista("");
            }}
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 max-sm:min-h-11 dark:text-brand-400"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <Card plana>
        {cargando && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState ilustracion="calendario" title="Aún no hay reservas registradas" />
        ) : !filtradas.length ? (
          <EmptyState title="Sin resultados" description="Ninguna reserva coincide con los filtros." />
        ) : (
          <>
            <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
              Primero las próximas, de la más cercana a la más lejana; después las anteriores.
            </p>

            {/* Celular: una tarjeta por reserva (espacio y estado, fecha y horario, residente y accion).
                Desde 640 px: tabla. */}
            <ul className="divide-y divide-slate-100 sm:hidden dark:divide-slate-700/60">
              {filtradas.map((r) => (
                <li key={r.id} className="space-y-1.5 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-medium text-slate-900 dark:text-slate-100">{r.espacioComun.nombre}</p>
                    <BadgeEstadoReserva estado={estadoVisible(r)} />
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatFecha(r.fecha)} · {r.horaInicio} - {r.horaFin}
                  </p>
                  <p className="break-words text-sm text-slate-600 dark:text-slate-300">{nombreDe(r)}</p>
                  {puedeCancelar(r) && (
                    <Button size="sm" variant="secondary" className="mt-1 w-full" onClick={() => cancelar(r)}>
                      Cancelar reserva
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-3">Espacio</th>
                    <th scope="col" className="px-5 py-3">Residente</th>
                    <th scope="col" className="px-5 py-3">Fecha</th>
                    <th scope="col" className="px-5 py-3">Horario</th>
                    <th scope="col" className="px-5 py-3">Estado</th>
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filtradas.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{r.espacioComun.nombre}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{nombreDe(r)}</td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-600 dark:text-slate-300">{formatFecha(r.fecha)}</td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                        {r.horaInicio} - {r.horaFin}
                      </td>
                      <td className="px-5 py-3">
                        <BadgeEstadoReserva estado={estadoVisible(r)} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {puedeCancelar(r) && (
                          <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => cancelar(r)}>
                            Cancelar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
