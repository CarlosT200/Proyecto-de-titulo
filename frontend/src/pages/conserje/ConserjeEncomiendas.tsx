import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Package } from "@phosphor-icons/react";
import { encomiendasApi, usuariosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Button, Card, CardHeader, Input, Label, PageHeader, Select, Textarea } from "../../components/ui";
import { ListaEncomiendas } from "../../components/Encomiendas";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";

// Empresas de despacho mas conocidas en Chile. "OTRO" habilita un campo de texto libre para
// remitentes que no esten en la lista.
const EMPRESAS_ENCOMIENDA = [
  "Correos de Chile",
  "Chilexpress",
  "Starken",
  "Blue Express",
  "Mercado Libre",
  "DHL",
  "FedEx",
  "UPS",
  "TNT",
  "Servientrega",
  "Turbus Cargo",
];

export default function ConserjeEncomiendas() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data, cargando, error, recargar } = useAsync(() => encomiendasApi.listarTodas(), []);
  const { data: residentes } = useAsync(() => usuariosApi.listar({ rol: "RESIDENTE", activo: true }), []);

  const [usuarioId, setUsuarioId] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [otroRemitente, setOtroRemitente] = useState("");
  const [numeroSeguimiento, setNumeroSeguimiento] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const fotoRef = useRef<HTMLInputElement>(null);
  const residenteRef = useRef<HTMLSelectElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Desde el inicio ("Registrar encomienda") se llega con ?registrar=1: el foco va directo al formulario.
  useEffect(() => {
    if (params.get("registrar") !== "1") return;
    residenteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    residenteRef.current?.focus({ preventScroll: true });
    setParams(
      (actuales) => {
        const siguientes = new URLSearchParams(actuales);
        siguientes.delete("registrar");
        return siguientes;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const esOtro = empresa === "OTRO";
  const remitente = (esOtro ? otroRemitente : empresa).trim();

  function limpiarFormulario() {
    setUsuarioId("");
    setEmpresa("");
    setOtroRemitente("");
    setNumeroSeguimiento("");
    setUbicacion("");
    setObservaciones("");
    if (fotoRef.current) fotoRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEnviando(true);
    try {
      const datos = new FormData();
      datos.append("usuarioId", usuarioId);
      if (remitente) datos.append("remitente", remitente);
      if (numeroSeguimiento.trim()) datos.append("numeroSeguimiento", numeroSeguimiento.trim());
      if (ubicacion.trim()) datos.append("ubicacion", ubicacion.trim());
      if (observaciones.trim()) datos.append("observaciones", observaciones.trim());
      const foto = fotoRef.current?.files?.[0];
      if (foto) datos.append("foto", foto);

      await encomiendasApi.crear(datos);
      limpiarFormulario();
      toast.success("Encomienda registrada. El residente ya fue notificado.");
      recargar();
    } catch (err) {
      setFormError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Encomiendas" subtitle="Registra lo que llega y entrégalo a cada residente." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Registrar encomienda" subtitle="El residente recibe un aviso al instante." />
          <form onSubmit={handleSubmit} className="space-y-3 p-5">
            <div>
              <Label htmlFor="campo-encomiendas-residente">Residente</Label>
              <Select
                ref={residenteRef}
                id="campo-encomiendas-residente"
                required
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value)}
              >
                <option value="">Selecciona un residente</option>
                {residentes?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} {r.apellido}
                    {r.departamento ? ` (${[r.departamento.torre?.nombre, r.departamento.numero].filter(Boolean).join(" ")})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="campo-encomiendas-empresa">Remitente o empresa (opcional)</Label>
              <Select id="campo-encomiendas-empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
                <option value="">Sin especificar</option>
                {EMPRESAS_ENCOMIENDA.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
                <option value="OTRO">Otro…</option>
              </Select>
            </div>
            {esOtro && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                <Label htmlFor="campo-encomiendas-otro">Especifica el remitente</Label>
                <Input
                  id="campo-encomiendas-otro"
                  autoFocus
                  required
                  maxLength={80}
                  value={otroRemitente}
                  onChange={(e) => setOtroRemitente(e.target.value)}
                  placeholder="Ej: Amazon, tienda del barrio, particular…"
                />
              </motion.div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div>
                <Label htmlFor="campo-encomiendas-seguimiento">N° de seguimiento (opcional)</Label>
                <Input
                  id="campo-encomiendas-seguimiento"
                  maxLength={60}
                  value={numeroSeguimiento}
                  onChange={(e) => setNumeroSeguimiento(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div>
                <Label htmlFor="campo-encomiendas-ubicacion">Dónde quedó guardada (opcional)</Label>
                <Input
                  id="campo-encomiendas-ubicacion"
                  maxLength={60}
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Ej: Estante B"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="campo-encomiendas-observaciones">Observaciones (opcional)</Label>
              <Textarea
                id="campo-encomiendas-observaciones"
                rows={2}
                maxLength={500}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: Caja grande, llegó con la esquina dañada."
              />
            </div>
            <div>
              <Label htmlFor="campo-encomiendas-foto">Foto (opcional)</Label>
              <input
                id="campo-encomiendas-foto"
                ref={fotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="block w-full text-sm text-slate-600 file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:text-slate-300 dark:file:bg-brand-500/15 dark:file:text-brand-200"
              />
            </div>
            {formError && <Alert tone="red">{formError}</Alert>}
            <Button type="submit" className="w-full" loading={enviando}>
              Registrar y notificar
            </Button>
          </form>
        </Card>

        <div className="xl:col-span-2">
          <ListaEncomiendas data={data} cargando={cargando} error={error} puedeGestionar onActualizada={recargar} />
        </div>
      </div>
    </div>
  );
}
