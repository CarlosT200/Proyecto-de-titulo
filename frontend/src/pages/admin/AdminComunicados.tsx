import { FormEvent, useState } from "react";
import { Megaphone, Trash } from "@phosphor-icons/react";
import { comunicadosApi } from "../../api/endpoints";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Button, Card, CardHeader, EmptyState, Input, Label, PageHeader, SearchInput, Select, Spinner, Textarea } from "../../components/ui";
import { ItemComunicado } from "../../components/Comunicados";
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
  const [nuevoId, setNuevoId] = useState<string | null>(null);

  const filtrados = (data ?? []).filter(
    (c) => !busqueda || `${c.titulo} ${c.contenido}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  async function handleEliminar(id: string, titulo: string) {
    const ok = await confirmar(`¿Eliminar el comunicado "${titulo}"? Ya no será visible para los residentes.`, {
      titulo: "Eliminar comunicado",
      textoConfirmar: "Eliminar",
    });
    if (!ok) return;
    try {
      await comunicadosApi.eliminar(id);
      toast.info("Comunicado eliminado.");
      recargar();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setEnviando(true);
    try {
      const creado = await comunicadosApi.crear({ titulo, contenido, tipo });
      setNuevoId(creado.id);
      setBusqueda("");
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
      <PageHeader icon={Megaphone} title="Comunicados" subtitle="Publicación de avisos para los residentes." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card plana className="lg:col-span-2">
          <CardHeader nivel={2} title="Comunicados publicados" />
          <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-700/60">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar comunicados..." className="w-full sm:max-w-xs" />
          </div>
          {cargando && !data ? (
            <Spinner />
          ) : error ? (
            <Alert tone="red">{error}</Alert>
          ) : !data?.length ? (
            <EmptyState ilustracion="comunicado" title="Aún no hay comunicados publicados" description="Publica el primero con el formulario." />
          ) : !filtrados.length ? (
            <EmptyState title="Sin resultados" description="Ningún comunicado coincide con la búsqueda." />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filtrados.map((c) => (
                <ItemComunicado
                  key={c.id}
                  nuevo={c.id === nuevoId}
                  comunicado={c}
                  accion={
                    <button
                      type="button"
                      onClick={() => handleEliminar(c.id, c.titulo)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 max-sm:p-3.5 dark:text-slate-400 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                      aria-label={`Eliminar el comunicado "${c.titulo}"`}
                      title="Eliminar comunicado"
                    >
                      <Trash size={16} />
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </Card>

        {/* En celular el formulario va primero (publicar es la tarea principal); en escritorio queda
            fijo a la derecha mientras se recorre la lista. */}
        <Card plana className="order-first h-fit lg:sticky lg:top-24 lg:order-none">
          <CardHeader nivel={2} title="Publicar nuevo comunicado" />
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
