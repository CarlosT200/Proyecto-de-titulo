import { ReactNode, useState } from "react";
import clsx from "clsx";
import { ArrowSquareOut, FileText, Trash } from "@phosphor-icons/react";
import { EmptyState, SearchInput } from "./ui";
import { useAcercarAlAparecer } from "../hooks/useAcercarAlAparecer";
import { formatDia } from "../lib/format";
import { horasDesde } from "../lib/tiempo";
import type { Documento } from "../types";

const SIN_CATEGORIA = "General";
const categoriaDe = (d: Documento) => d.categoria?.trim() || SIN_CATEGORIA;

export function categoriasDe(docs: Documento[]): string[] {
  return [...new Set(docs.map(categoriaDe))].sort((a, b) => a.localeCompare(b, "es"));
}

function FilaDocumento({ nuevo, children }: { nuevo: boolean; children: ReactNode }) {
  const ref = useAcercarAlAparecer<HTMLLIElement>(nuevo, 1023);
  return (
    <li ref={ref} className={clsx("flex items-stretch", nuevo && "animate-aparece")}>
      {children}
    </li>
  );
}

// Lista de documentos con buscador y categorias como filtros (botones que se encienden y apagan).
// Cada fila completa abre el documento; la administracion ademas puede eliminarlo.
export function ListaDocumentos({
  docs,
  onAbrir,
  onEliminar,
  nuevoId = null,
  marcarRecientes = false,
}: {
  docs: Documento[];
  onAbrir: (doc: Documento) => void;
  onEliminar?: (doc: Documento) => void;
  nuevoId?: string | null;
  /** Para residentes: marca "Nuevo" lo publicado en los ultimos 7 dias. */
  marcarRecientes?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const categorias = categoriasDe(docs);

  const filtrados = docs
    .filter((d) => !categoria || categoriaDe(d) === categoria)
    .filter((d) => !busqueda || `${d.titulo} ${categoriaDe(d)}`.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <div className="space-y-3 border-b border-slate-100 p-5 dark:border-slate-700/60">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar documento..." className="w-full sm:max-w-sm" />
        {categorias.length > 1 && (
          <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
            {["", ...categorias].map((c) => (
              <button
                key={c || "todas"}
                type="button"
                aria-pressed={categoria === c}
                onClick={() => setCategoria(c)}
                className={clsx(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:min-h-9",
                  categoria === c
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                )}
              >
                {c || "Todas"}
              </button>
            ))}
          </div>
        )}
      </div>

      {!filtrados.length ? (
        <EmptyState title="Sin resultados" description="Ningún documento coincide con la búsqueda." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {filtrados.map((doc) => {
            const reciente = marcarRecientes && horasDesde(doc.createdAt) < 24 * 7;
            return (
              <FilaDocumento key={doc.id} nuevo={doc.id === nuevoId}>
                <button
                  type="button"
                  onClick={() => onAbrir(doc)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:hover:bg-slate-700/50"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                    <FileText size={22} weight="duotone" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="break-words font-medium text-slate-900 dark:text-slate-100">{doc.titulo}</span>
                      {reciente && (
                        <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-semibold text-accent-800 dark:bg-accent-500/20 dark:text-accent-200">
                          Nuevo
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">
                      {categoriaDe(doc)} · {formatDia(doc.createdAt)}
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-brand-700 sm:inline-flex dark:text-brand-300">
                    Abrir <ArrowSquareOut size={16} aria-hidden />
                  </span>
                  <ArrowSquareOut size={18} className="shrink-0 text-brand-600 sm:hidden dark:text-brand-300" aria-hidden />
                  <span className="sr-only"> (se abre en una pestaña nueva)</span>
                </button>
                {onEliminar && (
                  <button
                    type="button"
                    onClick={() => onEliminar(doc)}
                    aria-label={`Eliminar "${doc.titulo}"`}
                    title="Eliminar documento"
                    className="flex w-14 shrink-0 items-center justify-center border-l border-slate-100 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500 dark:border-slate-700/60 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  >
                    <Trash size={18} aria-hidden />
                  </button>
                )}
              </FilaDocumento>
            );
          })}
        </ul>
      )}
    </div>
  );
}
