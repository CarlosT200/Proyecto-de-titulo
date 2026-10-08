import { FormEvent, useState } from "react";
import clsx from "clsx";
import { Plus, Trash, Warning } from "@phosphor-icons/react";
import { multasApi, usuariosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { useFiltroUrl } from "../../hooks/useFiltroUrl";
import { usePulsoAlCambiar } from "../../hooks/usePulsoAlCambiar";
import { Alert, Button, Card, EmptyState, Input, Label, Modal, PageHeader, SearchInput, Select, Spinner, Textarea } from "../../components/ui";
import { BadgeEstadoMulta } from "../../components/Multas";
import { formatFecha, formatMonto, hoyLocal } from "../../lib/format";
import { ESTADO_MULTA_LABEL } from "../../lib/badges";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import type { EstadoMulta, Multa } from "../../types";

const ESTADOS: EstadoMulta[] = ["PENDIENTE", "PAGADA", "APELADA", "ANULADA"];

type CeldaDeResumen = { estado: EstadoMulta; titulo: string; valor: string; detalle: string; alerta?: boolean };

// Una cifra del resumen. Si cambia (al marcar una multa como pagada, por ejemplo) la celda se ilumina
// y se apaga (1,2 s, solo opacidad): indica que algo cambio. Con "reducir movimiento" no se anima.
function CeldaResumen({ celda: c, activa, onToggle }: { celda: CeldaDeResumen; activa: boolean; onToggle: () => void }) {
  const pulso = usePulsoAlCambiar(c.valor);
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onToggle}
      className={clsx(
        "relative block bg-white px-3 py-4 text-left transition-colors [container-type:inline-size] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:bg-slate-800 dark:hover:bg-slate-700/60 sm:px-5",
        activa && "ring-2 ring-inset ring-brand-500"
      )}
    >
      {pulso > 0 && (
        <span key={pulso} aria-hidden className="pointer-events-none absolute inset-0 animate-cifra-cambio bg-brand-500/10 dark:bg-brand-400/15" />
      )}
      <span className="relative block text-sm text-slate-600 dark:text-slate-300">{c.titulo}</span>
      <span
        style={c.valor.length > 6 ? { fontSize: `min(1.5rem, ${(100 / (c.valor.length * 0.62)).toFixed(1)}cqi)` } : undefined}
        className={clsx(
          "relative mt-1 block whitespace-nowrap font-display text-2xl font-bold tabular-nums tracking-tight",
          c.valor === "0" || c.valor === "$0"
            ? "text-slate-500 dark:text-slate-400"
            : c.alerta
              ? "text-amber-700 dark:text-amber-300"
              : "text-slate-900 dark:text-white"
        )}
      >
        {c.valor}
      </span>
      <span className="relative mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{c.detalle}</span>
    </button>
  );
}

// Resumen de lo que importa al abrir la pantalla; cada cifra filtra la lista por ese estado
// (y vuelve a tocarla para quitar el filtro). Se calcula con todas las multas, no con el filtro.
function ResumenMultas({
  multas,
  filtro,
  onFiltrar,
}: {
  multas: Multa[];
  filtro: EstadoMulta | "";
  onFiltrar: (estado: EstadoMulta | "") => void;
}) {
  const de = (estado: EstadoMulta) => {
    const lista = multas.filter((m) => m.estado === estado);
    return { n: lista.length, monto: lista.reduce((s, m) => s + m.monto, 0) };
  };
  const pendientes = de("PENDIENTE");
  const apeladas = de("APELADA");
  const pagadas = de("PAGADA");
  const celdas: CeldaDeResumen[] = [
    {
      estado: "PENDIENTE",
      titulo: "Por cobrar",
      valor: formatMonto(pendientes.monto),
      detalle: `${pendientes.n} ${pendientes.n === 1 ? "pendiente" : "pendientes"}`,
      alerta: pendientes.n > 0,
    },
    { estado: "APELADA", titulo: "Apeladas", valor: String(apeladas.n), detalle: apeladas.n === 1 ? "por resolver" : "por resolver" },
    { estado: "PAGADA", titulo: "Cobrado", valor: formatMonto(pagadas.monto), detalle: `${pagadas.n} ${pagadas.n === 1 ? "pagada" : "pagadas"}` },
  ];
  return (
    <Card plana className="overflow-hidden">
      <div className="grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-700/60">
        {celdas.map((c) => (
          <CeldaResumen key={c.estado} celda={c} activa={filtro === c.estado} onToggle={() => onFiltrar(filtro === c.estado ? "" : c.estado)} />
        ))}
      </div>
    </Card>
  );
}

// Lo que el residente escribio al apelar: la administracion lo necesita a la vista para decidir.
function Apelacion({ multa }: { multa: Multa }) {
  if (!multa.apelacion) return null;
  return (
    <p className="mt-1 break-words rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
      <span className="font-semibold">Apelación del residente{multa.apeladaEn ? ` (${formatFecha(multa.apeladaEn)})` : ""}:</span>{" "}
      {multa.apelacion}
    </p>
  );
}

export default function AdminMultas() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { data, cargando, error, recargar } = useAsync(() => multasApi.listarTodas(), []);
  const { data: residentes } = useAsync(() => usuariosApi.listar({ rol: "RESIDENTE" }), []);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useFiltroUrl("estado", ESTADOS);

  const filtradas = (data ?? []).filter((m) => {
    const texto = `${m.motivo} ${m.usuario?.nombre ?? ""} ${m.usuario?.apellido ?? ""}`.toLowerCase();
    const coincideTexto = !busqueda || texto.includes(busqueda.toLowerCase());
    const coincideEstado = !filtroEstado || m.estado === filtroEstado;
    return coincideTexto && coincideEstado;
  });

  async function handleEliminar(id: string, motivo: string) {
    const ok = await confirmar(`¿Eliminar la multa "${motivo}"? Esta acción no se puede deshacer.`, {
      titulo: "Eliminar multa",
      textoConfirmar: "Eliminar",
    });
    if (!ok) return;
    try {
      await multasApi.eliminar(id);
      toast.info("Multa eliminada.");
      recargar();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  }

  // Cada cambio de estado le llega al residente como aviso, asi que marcar una multa como pagada o
  // anulada pide confirmacion (un toque equivocado en el selector cobraba o perdonaba una multa), y
  // si el cambio falla se avisa en vez de quedar en silencio. El selector es controlado: si se
  // cancela o falla, vuelve solo al estado anterior.
  async function cambiarEstado(m: Multa, nuevo: EstadoMulta) {
    if (nuevo === m.estado) return;
    const etiqueta = ESTADO_MULTA_LABEL[nuevo].toLowerCase();
    if (nuevo === "PAGADA" || nuevo === "ANULADA") {
      const ok = await confirmar(
        `¿Marcar la multa "${m.motivo}" como ${etiqueta}? ${
          nuevo === "ANULADA" ? "Dejará de contar como cobro." : "Quedará registrada como cobrada."
        } El residente recibirá un aviso.`,
        { titulo: `Marcar como ${etiqueta}`, textoConfirmar: `Marcar como ${etiqueta}`, tono: "normal" }
      );
      if (!ok) return;
    }
    try {
      await multasApi.actualizar(m.id, { estado: nuevo });
      toast.success(`Multa marcada como ${etiqueta}.`);
      recargar();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo cambiar el estado de la multa."));
    }
  }

  const nombreDe = (m: Multa) => (m.usuario ? `${m.usuario.nombre} ${m.usuario.apellido}` : "—");

  const selectorEstado = (m: Multa, className: string) => (
    <Select
      aria-label={`Cambiar el estado de la multa: ${m.motivo}`}
      className={className}
      value={m.estado}
      onChange={(e) => cambiarEstado(m, e.target.value as EstadoMulta)}
    >
      {ESTADOS.map((estado) => (
        <option key={estado} value={estado}>
          {ESTADO_MULTA_LABEL[estado]}
        </option>
      ))}
    </Select>
  );

  const botonEliminar = (m: Multa) => (
    <button
      type="button"
      onClick={() => handleEliminar(m.id, m.motivo)}
      className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 max-sm:p-3.5 dark:text-slate-400 dark:hover:bg-red-500/20 dark:hover:text-red-400"
      aria-label={`Eliminar la multa: ${m.motivo}`}
      title="Eliminar multa"
    >
      <Trash size={16} />
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Warning}
        title="Multas"
        subtitle="Registro y seguimiento de sanciones."
        action={
          <Button onClick={() => setModalAbierto(true)}>
            <Plus size={16} weight="bold" /> Registrar multa
          </Button>
        }
      />

      {data && data.length > 0 && <ResumenMultas multas={data} filtro={filtroEstado} onFiltrar={setFiltroEstado} />}

      <div className="flex flex-wrap gap-3">
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por motivo o residente..."
          className="w-full sm:max-w-xs"
        />
        <Select aria-label="Filtrar por estado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as EstadoMulta | "")} className="w-full sm:w-48">
          <option value="">Todos los estados</option>
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {ESTADO_MULTA_LABEL[estado]}
            </option>
          ))}
        </Select>
      </div>

      <Card plana>
        {cargando && !data ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState title="Aún no hay multas registradas" />
        ) : !filtradas.length ? (
          <EmptyState title="Sin resultados" description="Ninguna multa coincide con la búsqueda." />
        ) : (
          <>
            {/* Celular: una tarjeta por multa (nombre y estado arriba, motivo completo, monto y fecha,
                y las acciones juntas abajo). Desde 640 px: tabla. */}
            <ul className="divide-y divide-slate-100 sm:hidden dark:divide-slate-700/60">
              {filtradas.map((m) => (
                <li key={m.id} className="space-y-2 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words font-medium text-slate-900 dark:text-slate-100">{nombreDe(m)}</p>
                    <BadgeEstadoMulta estado={m.estado} />
                  </div>
                  <p className="break-words text-sm text-slate-700 dark:text-slate-300">{m.motivo}</p>
                  {m.observaciones && <p className="break-words text-xs text-slate-500 dark:text-slate-400">{m.observaciones}</p>}
                  <Apelacion multa={m} />
                  <p className="flex items-baseline gap-2 text-sm">
                    <span className={clsx("font-semibold tabular-nums", m.estado === "ANULADA" ? "text-slate-500 line-through dark:text-slate-400" : "text-slate-900 dark:text-white")}>
                      {formatMonto(m.monto)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatFecha(m.fecha)}</span>
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    {selectorEstado(m, "min-w-0 flex-1")}
                    {botonEliminar(m)}
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs uppercase text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-3">Residente</th>
                    <th scope="col" className="px-5 py-3">Motivo</th>
                    <th scope="col" className="px-5 py-3">Fecha</th>
                    <th scope="col" className="px-5 py-3 text-right">Monto</th>
                    <th scope="col" className="px-5 py-3">Estado</th>
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filtradas.map((m) => (
                    <tr key={m.id}>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{nombreDe(m)}</td>
                      <td className="max-w-xs px-5 py-3 text-slate-700 dark:text-slate-300">
                        <span className="block break-words">{m.motivo}</span>
                        {m.observaciones && <span className="mt-0.5 block break-words text-xs text-slate-500 dark:text-slate-400">{m.observaciones}</span>}
                        <Apelacion multa={m} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-600 dark:text-slate-300">{formatFecha(m.fecha)}</td>
                      <td
                        className={clsx(
                          "whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums",
                          m.estado === "ANULADA" ? "text-slate-500 line-through dark:text-slate-400" : "text-slate-900 dark:text-white"
                        )}
                      >
                        {formatMonto(m.monto)}
                      </td>
                      <td className="px-5 py-3">
                        <BadgeEstadoMulta estado={m.estado} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {selectorEstado(m, "w-36")}
                          {botonEliminar(m)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title="Registrar multa">
        <FormularioMulta
          residentes={residentes ?? []}
          onCreado={() => {
            setModalAbierto(false);
            recargar();
          }}
        />
      </Modal>
    </div>
  );
}

function FormularioMulta({
  residentes,
  onCreado,
}: {
  residentes: { id: string; nombre: string; apellido: string }[];
  onCreado: () => void;
}) {
  const toast = useToast();
  const [usuarioId, setUsuarioId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState(hoyLocal());
  const [monto, setMonto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await multasApi.crear({ usuarioId, motivo, fecha, monto: Number(monto), observaciones: observaciones || undefined });
      toast.success("Multa registrada correctamente.");
      onCreado();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="campo-multas-1">Residente</Label>
        <Select id="campo-multas-1" required value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
          <option value="">Selecciona un residente</option>
          {residentes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre} {r.apellido}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="campo-multas-2">Motivo</Label>
        <Input id="campo-multas-2" required value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="campo-multas-3">Fecha</Label>
          <Input id="campo-multas-3" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="campo-multas-4">Monto (CLP)</Label>
          <Input id="campo-multas-4" type="number" inputMode="numeric" min={1} step={1} required value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
      </div>
      <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">
        El monto es el valor final en pesos que verá el residente: la aplicación no agrega IVA ni otros impuestos.
      </p>
      <div>
        <Label htmlFor="campo-multas-5">Observaciones</Label>
        <Textarea id="campo-multas-5" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" className="w-full" loading={cargando}>
        Registrar multa
      </Button>
    </form>
  );
}
