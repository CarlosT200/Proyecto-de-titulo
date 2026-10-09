import { FormEvent, useRef, useState } from "react";
import { FileText, UploadSimple } from "@phosphor-icons/react";
import { documentosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Button, Card, CardHeader, EmptyState, Input, Label, PageHeader, Spinner } from "../../components/ui";
import { ListaDocumentos, categoriasDe } from "../../components/Documentos";
import { abrirDocumento } from "../../lib/documentos";
import { mensajeError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import type { Documento } from "../../types";

// Mismo limite que el servidor (middleware/upload.ts): se avisa antes de subir para no esperar en vano.
const MAXIMO_BYTES = 8 * 1024 * 1024;

function tamanoLegible(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toLocaleString("es-CL", { maximumFractionDigits: 1 })} MB`;
}

export default function AdminDocumentos() {
  const toast = useToast();
  const confirmar = useConfirm();
  const { data, cargando, error, recargar } = useAsync(() => documentosApi.listar(), []);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [nuevoId, setNuevoId] = useState<string | null>(null);

  async function handleEliminar(doc: Documento) {
    const ok = await confirmar(`¿Eliminar el documento "${doc.titulo}"? Ya no estará disponible para los residentes.`, {
      titulo: "Eliminar documento",
      textoConfirmar: "Eliminar",
      textoCancelar: "Volver",
    });
    if (!ok) return;
    try {
      await documentosApi.eliminar(doc.id);
      toast.info("Documento eliminado.");
      recargar();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!archivo) {
      setFormError("Selecciona un archivo.");
      return;
    }
    if (archivo.size > MAXIMO_BYTES) {
      setFormError(`El archivo pesa ${tamanoLegible(archivo.size)}; el máximo es 8 MB.`);
      return;
    }
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("titulo", titulo.trim());
      if (categoria.trim()) formData.append("categoria", categoria.trim());
      formData.append("archivo", archivo);
      const creado = await documentosApi.crear(formData);
      setTitulo("");
      setCategoria("");
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = "";
      setNuevoId(creado.id);
      toast.success("Documento publicado. Los residentes ya pueden verlo.");
      recargar();
    } catch (err) {
      setFormError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  }

  const categorias = categoriasDe(data ?? []).filter((c) => c !== "General");

  return (
    <div className="space-y-6">
      <PageHeader icon={FileText} title="Repositorio de documentos" subtitle="Reglamentos, actas y documentos para los residentes." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card plana className="overflow-hidden lg:col-span-2">
          <CardHeader nivel={2} title="Documentos publicados" subtitle={data?.length ? `${data.length} ${data.length === 1 ? "documento" : "documentos"}` : undefined} />
          {cargando && !data ? (
            <Spinner />
          ) : error ? (
            <Alert tone="red">{error}</Alert>
          ) : !data?.length ? (
            <EmptyState icon={FileText} title="Aún no hay documentos publicados" description="Publica el reglamento interno con el formulario." />
          ) : (
            <ListaDocumentos
              docs={data}
              nuevoId={nuevoId}
              onEliminar={handleEliminar}
              onAbrir={(doc) => abrirDocumento(doc.id).catch((err) => toast.error(mensajeError(err, "No se pudo abrir el documento.")))}
            />
          )}
        </Card>

        <Card plana className="h-fit max-lg:order-first">
          <CardHeader nivel={2} title="Publicar documento" subtitle="Los residentes lo verán en su sección Documentos." />
          <form onSubmit={handleSubmit} className="space-y-3 p-5">
            <div>
              <Label htmlFor="campo-documentos-1">Título</Label>
              <Input id="campo-documentos-1" required maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Reglamento interno 2026" />
            </div>
            <div>
              <Label htmlFor="campo-documentos-2">Categoría (opcional)</Label>
              <Input
                id="campo-documentos-2"
                list="categorias-documentos"
                maxLength={60}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ej: Reglamento, Actas, Seguros"
              />
              {/* sugiere las categorias ya usadas, para no tener "Reglamento" y "reglamentos" */}
              <datalist id="categorias-documentos">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="campo-documentos-archivo">Archivo (PDF o imagen, hasta 8 MB)</Label>
              <label
                htmlFor="campo-documentos-archivo"
                className="flex min-h-[4.5rem] cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm transition-colors hover:border-brand-400 hover:bg-brand-50/50 focus-within:border-brand-500 dark:border-slate-600 dark:hover:border-brand-400 dark:hover:bg-brand-500/10"
              >
                <UploadSimple size={24} className="shrink-0 text-brand-600 dark:text-brand-300" aria-hidden />
                <span className="min-w-0">
                  {archivo ? (
                    <>
                      <span className="block break-all font-medium text-slate-900 dark:text-slate-100">{archivo.name}</span>
                      <span className="text-slate-600 dark:text-slate-300">{tamanoLegible(archivo.size)} · toca para cambiarlo</span>
                    </>
                  ) : (
                    <span className="text-slate-700 dark:text-slate-200">Toca para elegir el archivo</span>
                  )}
                </span>
                <input
                  id="campo-documentos-archivo"
                  ref={fileRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="sr-only"
                  onChange={(e) => {
                    setArchivo(e.target.files?.[0] ?? null);
                    setFormError(null);
                  }}
                />
              </label>
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
