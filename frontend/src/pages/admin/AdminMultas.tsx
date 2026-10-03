import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash, Warning } from "@phosphor-icons/react";
import { multasApi, usuariosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Label, Modal, PageHeader, SearchInput, Select, Spinner, Textarea, staggerFade } from "../../components/ui";
import { formatFecha, formatMonto, hoyLocal } from "../../lib/format";
import { ESTADO_MULTA_LABEL, ESTADO_MULTA_TONO } from "../../lib/badges";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import type { EstadoMulta } from "../../types";

const ESTADOS: EstadoMulta[] = ["PENDIENTE", "PAGADA", "APELADA", "ANULADA"];

export default function AdminMultas() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { data, cargando, error, recargar } = useAsync(() => multasApi.listarTodas(), []);
  const { data: residentes } = useAsync(() => usuariosApi.listar({ rol: "RESIDENTE" }), []);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoMulta | "">("");

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
    await multasApi.eliminar(id);
    toast.info("Multa eliminada.");
    recargar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Warning}
        title="Multas"
        subtitle="Registro y seguimiento de sanciones (HU-06, HU-07)."
        action={
          <Button onClick={() => setModalAbierto(true)}>
            <Plus size={16} weight="bold" /> Registrar multa
          </Button>
        }
      />

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

      <Card>
        {cargando ? (
          <Spinner />
        ) : error ? (
          <Alert tone="red">{error}</Alert>
        ) : !data?.length ? (
          <EmptyState title="Aún no hay multas registradas" />
        ) : !filtradas.length ? (
          <EmptyState title="Sin resultados" description="Ninguna multa coincide con la búsqueda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-700/60 text-xs uppercase text-slate-400 dark:text-slate-500">
                <tr>
                  <th className="px-5 py-3">Residente</th>
                  <th className="px-5 py-3">Motivo</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Monto</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {filtradas.map((m, i) => (
                  <motion.tr key={m.id} {...staggerFade(i)} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {m.usuario ? `${m.usuario.nombre} ${m.usuario.apellido}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{m.motivo}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatFecha(m.fecha)}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatMonto(m.monto)}</td>
                    <td className="px-5 py-3">
                      <Select
                        aria-label={`Estado de la multa: ${m.motivo}`}
                        className="w-36"
                        value={m.estado}
                        onChange={async (e) => {
                          await multasApi.actualizar(m.id, { estado: e.target.value });
                          toast.success(`Multa actualizada a ${ESTADO_MULTA_LABEL[e.target.value] ?? e.target.value}.`);
                          recargar();
                        }}
                      >
                        {ESTADOS.map((estado) => (
                          <option key={estado} value={estado}>
                            {ESTADO_MULTA_LABEL[estado]}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleEliminar(m.id, m.motivo)}
                        className="rounded-lg p-1.5 max-sm:p-3 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                        aria-label="Eliminar multa"
                        title="Eliminar multa"
                      >
                        <Trash size={16} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <Input id="campo-multas-4" type="number" min={1} required value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
      </div>
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
