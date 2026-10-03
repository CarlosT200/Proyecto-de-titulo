import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Trash } from "@phosphor-icons/react";
import { comunicadosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Label, PageHeader, SearchInput, Select, Spinner, staggerFade, Textarea } from "../../components/ui";
import { formatFechaHora } from "../../lib/format";
import { TIPO_COMUNICADO_LABEL } from "../../lib/badges";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import type { TipoComunicado } from "../../types";

const TIPOS: TipoComunicado[] = [
  "GENERAL",
  "CORTE_AGUA",
  "CORTE_ELECTRICO",
  "MANTENCION",
  "REUNION",
  "EMERGENCIA",
  "CAMBIO_HORARIO",
];

export default function AdminComunicados() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { data, cargando, error, recargar } = useAsync(() => comunicadosApi.listar(), []);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [tipo, setTipo] = useState<TipoComunicado>("GENERAL");
  const [formError, setFormError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const filtrados = (data ?? []).filter(
    (c) => !busqueda || `${c.titulo} ${c.contenido}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  async function handleEliminar(id: string, titulo: string) {
    const ok = await confirmar(`¿Eliminar el comunicado "${titulo}"? Ya no será visible para los residentes.`, {
      titulo: "Eliminar comunicado",
      textoConfirmar: "Eliminar",
    });
    if (!ok) return;
    await comunicadosApi.eliminar(id);
    toast.info("Comunicado eliminado.");
    recargar();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEnviando(true);
    try {
      await comunicadosApi.crear({ titulo, contenido, tipo });
      setTitulo("");
      setContenido("");
      toast.success("Comunicado publicado y notificado a los residentes.");
      recargar();
    } catch (err) {
      setFormError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Megaphone} title="Comunicados" subtitle="Publicación de avisos para los residentes (HU-15, HU-16)." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Comunicados publicados"
            action={<SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar..." className="w-48" />}
          />
          {cargando ? (
            <Spinner />
          ) : error ? (
            <Alert tone="red">{error}</Alert>
          ) : !data?.length ? (
            <EmptyState icon={Megaphone} title="Aún no hay comunicados publicados" />
          ) : !filtrados.length ? (
            <EmptyState title="Sin resultados" description="Ningún comunicado coincide con la búsqueda." />
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filtrados.map((c, i) => (
                <motion.div key={c.id} {...staggerFade(i)} className="group flex items-start justify-between gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/60">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.titulo}</p>
                      <Badge tone="blue">{TIPO_COMUNICADO_LABEL[c.tipo]}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{c.contenido}</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{formatFechaHora(c.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEliminar(c.id, c.titulo)}
                    className="shrink-0 rounded-lg p-1.5 max-sm:p-3 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                    aria-label="Eliminar comunicado"
                    title="Eliminar comunicado"
                  >
                    <Trash size={16} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Publicar nuevo comunicado" />
          <form onSubmit={handleSubmit} className="space-y-3 p-5">
            <div>
              <Label htmlFor="campo-comunicados-1">Tipo</Label>
              <Select id="campo-comunicados-1" value={tipo} onChange={(e) => setTipo(e.target.value as TipoComunicado)}>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_COMUNICADO_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="campo-comunicados-2">Título</Label>
              <Input id="campo-comunicados-2" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="campo-comunicados-3">Contenido</Label>
              <Textarea id="campo-comunicados-3" required rows={4} value={contenido} onChange={(e) => setContenido(e.target.value)} />
            </div>
            {formError && <Alert tone="red">{formError}</Alert>}
            <Button type="submit" className="w-full" loading={enviando}>
              Publicar
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
