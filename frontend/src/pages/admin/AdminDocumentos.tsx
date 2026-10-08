import { FormEvent, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Trash } from "@phosphor-icons/react";
import { documentosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Button, Card, CardHeader, EmptyState, Input, Label, PageHeader, SearchInput, Spinner, staggerFade } from "../../components/ui";
import { formatFecha } from "../../lib/format";
import { abrirDocumento } from "../../lib/documentos";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";

export default function AdminDocumentos() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { data, cargando, error, recargar } = useAsync(() => documentosApi.listar(), []);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const filtrados = (data ?? []).filter(
    (doc) => !busqueda || `${doc.titulo} ${doc.categoria ?? ""}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  async function handleEliminar(id: string, titulo: string) {
    const ok = await confirmar(`¿Eliminar el documento "${titulo}"? Ya no estará disponible para los residentes.`, {
      titulo: "Eliminar documento",
      textoConfirmar: "Eliminar",
    });
    if (!ok) return;
    try {
      await documentosApi.eliminar(id);
      toast.info("Documento eliminado.");
      recargar();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  }

  function handleAbrir(id: string) {
    abrirDocumento(id).catch((err) => toast.error(mensajeError(err, "No se pudo abrir el documento.")));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const archivo = fileRef.current?.files?.[0];
    if (!archivo) {
      setFormError("Selecciona un archivo.");
      return;
    }
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("titulo", titulo);
      if (categoria) formData.append("categoria", categoria);
      formData.append("archivo", archivo);
      await documentosApi.crear(formData);
      setTitulo("");
      setCategoria("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Documento publicado correctamente.");
      recargar();
    } catch (err) {
      setFormError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={FileText} title="Repositorio de documentos" subtitle="Reglamentos y documentos informativos." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Documentos publicados"
            action={<SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar..." className="w-48" />}
          />
          {cargando ? (
            <Spinner />
          ) : error ? (
            <Alert tone="red">{error}</Alert>
          ) : !data?.length ? (
            <EmptyState icon={FileText} title="Aún no hay documentos publicados" />
          ) : !filtrados.length ? (
            <EmptyState title="Sin resultados" description="Ningún documento coincide con la búsqueda." />
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filtrados.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  {...staggerFade(i)}
                  className="group flex items-center justify-between gap-2 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60"
                >
                  <button type="button" onClick={() => handleAbrir(doc.id)} className="min-w-0 flex-1 text-left max-sm:min-h-11">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{doc.titulo}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {doc.categoria ?? "General"} · {formatFecha(doc.createdAt)}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1 max-sm:gap-2">
                    <button
                      type="button"
                      onClick={() => handleAbrir(doc.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-brand-600 transition-transform group-hover:translate-x-0.5 max-sm:min-h-11"
                    >
                      Ver <ArrowRight size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEliminar(doc.id, doc.titulo)}
                      className="rounded-lg p-1.5 max-sm:p-3.5 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                      aria-label="Eliminar documento"
                      title="Eliminar documento"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Publicar documento" />
          <form onSubmit={handleSubmit} className="space-y-3 p-5">
            <div>
              <Label htmlFor="campo-documentos-1">Título</Label>
              <Input id="campo-documentos-1" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="campo-documentos-2">Categoría</Label>
              <Input id="campo-documentos-2" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Reglamento" />
            </div>
            <div>
              <Label htmlFor="campo-documentos-archivo">Archivo (PDF, imagen)</Label>
              <input
                id="campo-documentos-archivo"
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                className="block w-full text-sm text-slate-600 file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:text-slate-300 dark:file:bg-brand-500/15 dark:file:text-brand-200"
              />
            </div>
            {formError && <Alert tone="red">{formError}</Alert>}
            <Button type="submit" className="w-full" loading={enviando}>
              Publicar documento
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
