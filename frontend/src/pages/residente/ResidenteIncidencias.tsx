import { FormEvent, useRef, useState } from "react";
import { incidenciasApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { motion } from "framer-motion";
import { Wrench } from "@phosphor-icons/react";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Label, PageHeader, Spinner, staggerFade, Textarea } from "../../components/ui";
import { formatFechaHora } from "../../lib/format";
import { ESTADO_INCIDENCIA_LABEL, ESTADO_INCIDENCIA_TONO } from "../../lib/badges";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export default function ResidenteIncidencias() {
  const toast = useToast();
  const { data, cargando, error, recargar } = useAsync(() => incidenciasApi.mias(), []);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("titulo", titulo);
      formData.append("descripcion", descripcion);
      formData.append("ubicacion", ubicacion);
      const archivo = fileRef.current?.files?.[0];
      if (archivo) formData.append("foto", archivo);

      await incidenciasApi.crear(formData);
      setTitulo("");
      setDescripcion("");
      setUbicacion("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Incidencia reportada correctamente.");
      recargar();
    } catch (err) {
      setFormError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Wrench} title="Incidencias" subtitle="Reporta problemas y haz seguimiento." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Mis incidencias" />
          {cargando ? (
            <Spinner />
          ) : error ? (
            <Alert tone="red">{error}</Alert>
          ) : !data?.length ? (
            <EmptyState icon={Wrench} title="Aún no has reportado incidencias" />
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {data.map((inc, i) => (
                <motion.div key={inc.id} {...staggerFade(i)} className="px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{inc.titulo}</p>
                    <Badge tone={ESTADO_INCIDENCIA_TONO[inc.estado]}>{ESTADO_INCIDENCIA_LABEL[inc.estado]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{inc.ubicacion}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{inc.descripcion}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Reportada el {formatFechaHora(inc.createdAt)}</p>
                </motion.div>
              ))}
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Reportar nueva incidencia" />
          <form onSubmit={handleSubmit} className="space-y-3 p-5">
            <div>
              <Label htmlFor="campo-incidencias-1">Título</Label>
              <Input id="campo-incidencias-1" required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Filtracion" />
            </div>
            <div>
              <Label htmlFor="campo-incidencias-2">Ubicación</Label>
              <Input id="campo-incidencias-2"
                required
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej: Estacionamiento subterraneo"
              />
            </div>
            <div>
              <Label htmlFor="campo-incidencias-3">Descripción</Label>
              <Textarea id="campo-incidencias-3" required rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="campo-incidencias-foto">Fotografía (opcional)</Label>
              <input id="campo-incidencias-foto" ref={fileRef} type="file" accept="image/*" className="block w-full text-sm" />
            </div>
            {formError && <Alert tone="red">{formError}</Alert>}
            <Button type="submit" className="w-full" loading={enviando}>
              Reportar incidencia
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
