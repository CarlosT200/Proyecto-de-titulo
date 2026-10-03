import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { encomiendasApi, usuariosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Package } from "@phosphor-icons/react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Label,
  PageHeader,
  SearchInput,
  Select,
  Spinner,
  staggerFade,
} from "../../components/ui";
import { formatFechaHora } from "../../lib/format";
import { fechaEnRango } from "../../lib/filters";
import { ESTADO_ENCOMIENDA_LABEL, ESTADO_ENCOMIENDA_TONO } from "../../lib/badges";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import type { EstadoEncomienda } from "../../types";

// Empresas de courier/encomiendas mas conocidas en Chile. "OTRO" habilita un
// campo de texto libre para remitentes que no esten en la lista.
const EMPRESAS_ENCOMIENDA = [
  "Correos de Chile",
  "Chilexpress",
  "Starken",
  "Blue Express",
  "DHL",
  "FedEx",
  "UPS",
  "TNT",
  "Servientrega",
  "Turbus Cargo",
];

const ESTADOS: EstadoEncomienda[] = ["NOTIFICADA", "RETIRADA"];

export default function ConserjeEncomiendas() {
  const toast = useToast();
  const { data, cargando, error, recargar } = useAsync(() => encomiendasApi.listarTodas(), []);
  const { data: residentes } = useAsync(() => usuariosApi.listar({ rol: "RESIDENTE" }), []);

  const [usuarioId, setUsuarioId] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [otroRemitente, setOtroRemitente] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoEncomienda | "">("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const esOtro = empresa === "OTRO";
  const remitente = esOtro ? otroRemitente : empresa;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEnviando(true);
    try {
      await encomiendasApi.crear({ usuarioId, remitente: remitente || undefined });
      setUsuarioId("");
      setEmpresa("");
      setOtroRemitente("");
      toast.success("Encomienda registrada y residente notificado.");
      recargar();
    } catch (err) {
      setFormError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  const filtradas = (data ?? []).filter((enc) => {
    const texto = `${enc.usuario?.nombre ?? ""} ${enc.usuario?.apellido ?? ""} ${enc.remitente ?? ""}`.toLowerCase();
    const coincideTexto = !busqueda || texto.includes(busqueda.toLowerCase());
    const coincideEstado = !filtroEstado || enc.estado === filtroEstado;
    const coincideFecha = fechaEnRango(enc.fechaRecepcion, fechaDesde, fechaHasta);
    return coincideTexto && coincideEstado && coincideFecha;
  });

  const hayFiltrosActivos = busqueda || filtroEstado || fechaDesde || fechaHasta;

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Encomiendas" subtitle="Registro de recepción y retiro." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Registrar encomienda" />
          <form onSubmit={handleSubmit} className="space-y-3 p-5">
            <div>
              <Label htmlFor="campo-encomiendas-1">Residente</Label>
              <Select id="campo-encomiendas-1" required value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                <option value="">Selecciona un residente</option>
                {residentes?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} {r.apellido}
                    {r.departamento ? ` (${r.departamento.torre?.nombre ?? ""} ${r.departamento.numero})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="campo-encomiendas-2">Remitente / empresa (opcional)</Label>
              <Select id="campo-encomiendas-2" value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
                <option value="">Sin especificar</option>
                {EMPRESAS_ENCOMIENDA.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
                <option value="OTRO">Otro...</option>
              </Select>
            </div>
            {esOtro && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                <Label htmlFor="campo-encomiendas-3">Especifica el remitente</Label>
                <Input id="campo-encomiendas-3"
                  autoFocus
                  value={otroRemitente}
                  onChange={(e) => setOtroRemitente(e.target.value)}
                  placeholder="Ej: Amazon, tienda local, particular..."
                />
              </motion.div>
            )}
            {formError && <Alert tone="red">{formError}</Alert>}
            <Button type="submit" className="w-full" loading={enviando}>
              Registrar y notificar
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Historial de encomiendas" subtitle="Busca por residente, remitente, estado o fecha" />

          <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 dark:border-slate-700/60 p-5">
            <div className="w-full sm:max-w-[16rem]">
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por residente o remitente..." />
            </div>
            <div className="w-full sm:w-40">
              <Label htmlFor="campo-encomiendas-4">Estado</Label>
              <Select id="campo-encomiendas-4" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as EstadoEncomienda | "")}>
                <option value="">Todos</option>
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {ESTADO_ENCOMIENDA_LABEL[estado]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-36">
              <Label htmlFor="campo-encomiendas-5">Desde</Label>
              <Input id="campo-encomiendas-5" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </div>
            <div className="w-full sm:w-36">
              <Label htmlFor="campo-encomiendas-6">Hasta</Label>
              <Input id="campo-encomiendas-6" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </div>
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda("");
                  setFiltroEstado("");
                  setFechaDesde("");
                  setFechaHasta("");
                }}
                className="text-xs text-brand-600 hover:underline max-sm:min-h-11"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {cargando ? (
            <Spinner />
          ) : error ? (
            <Alert tone="red">{error}</Alert>
          ) : !data?.length ? (
            <EmptyState icon={Package} title="Aún no hay encomiendas registradas" />
          ) : !filtradas.length ? (
            <EmptyState title="Sin resultados" description="Ninguna encomienda coincide con los filtros." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 dark:border-slate-700/60 text-xs uppercase text-slate-400 dark:text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Residente</th>
                    <th className="px-5 py-3">Remitente</th>
                    <th className="px-5 py-3">Recepción</th>
                    <th className="px-5 py-3">Retiro</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {filtradas.map((enc, i) => (
                    <motion.tr key={enc.id} {...staggerFade(i)} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">
                        {enc.usuario ? `${enc.usuario.nombre} ${enc.usuario.apellido}` : "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{enc.remitente ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatFechaHora(enc.fechaRecepcion)}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        {enc.fechaRetiro ? formatFechaHora(enc.fechaRetiro) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={ESTADO_ENCOMIENDA_TONO[enc.estado]}>{ESTADO_ENCOMIENDA_LABEL[enc.estado]}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {enc.estado !== "RETIRADA" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              await encomiendasApi.marcarRetirada(enc.id);
                              toast.success("Encomienda marcada como retirada.");
                              recargar();
                            }}
                          >
                            Marcar retirada
                          </Button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
