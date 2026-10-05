// Categorias de incidencias. Es la UNICA lista: la usan el formulario del residente, la gestion de
// la administracion y el clasificador automatico (clasificador-ia.ts). El frontend tiene una copia
// identica en frontend/src/lib/categorias.ts.
//
// Se guarda el codigo (ej. "AGUA"). Las incidencias antiguas tienen texto libre ("Filtración",
// "Eléctrico"...): normalizarCategoria() los traduce al codigo equivalente sin modificar la base.

export const CATEGORIAS_INCIDENCIA = [
  { codigo: "AGUA", etiqueta: "Agua y filtraciones" },
  { codigo: "ELECTRICIDAD", etiqueta: "Electricidad" },
  { codigo: "ASCENSOR", etiqueta: "Ascensor" },
  { codigo: "PUERTAS_ACCESOS", etiqueta: "Puertas y accesos" },
  { codigo: "INFRAESTRUCTURA", etiqueta: "Muros, techos y pisos" },
  { codigo: "LIMPIEZA", etiqueta: "Limpieza y basura" },
  { codigo: "PLAGAS", etiqueta: "Plagas" },
  { codigo: "RUIDOS", etiqueta: "Ruidos molestos" },
  { codigo: "ESTACIONAMIENTO", etiqueta: "Estacionamiento" },
  { codigo: "AREAS_VERDES", etiqueta: "Áreas verdes" },
  { codigo: "SEGURIDAD", etiqueta: "Seguridad" },
  { codigo: "MASCOTAS", etiqueta: "Mascotas" },
  { codigo: "OTROS", etiqueta: "Otros" },
] as const;

export type CategoriaIncidencia = (typeof CATEGORIAS_INCIDENCIA)[number]["codigo"];

export const CODIGOS_CATEGORIA = CATEGORIAS_INCIDENCIA.map((c) => c.codigo) as [CategoriaIncidencia, ...CategoriaIncidencia[]];

// Nombres que se usaban antes (texto libre o el clasificador anterior) -> codigo actual.
const EQUIVALENCIAS: Record<string, CategoriaIncidencia> = {
  agua: "AGUA",
  filtracion: "AGUA",
  filtraciones: "AGUA",
  electrico: "ELECTRICIDAD",
  electricidad: "ELECTRICIDAD",
  ascensor: "ASCENSOR",
  puertas: "PUERTAS_ACCESOS",
  acceso: "PUERTAS_ACCESOS",
  accesos: "PUERTAS_ACCESOS",
  estructural: "INFRAESTRUCTURA",
  infraestructura: "INFRAESTRUCTURA",
  limpieza: "LIMPIEZA",
  basura: "LIMPIEZA",
  plaga: "PLAGAS",
  plagas: "PLAGAS",
  ruido: "RUIDOS",
  ruidos: "RUIDOS",
  estacionamiento: "ESTACIONAMIENTO",
  "areas verdes": "AREAS_VERDES",
  jardin: "AREAS_VERDES",
  seguridad: "SEGURIDAD",
  mascotas: "MASCOTAS",
  mascota: "MASCOTAS",
  otro: "OTROS",
  otros: "OTROS",
};

function sinTildes(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Codigo de categoria para un valor guardado (codigo actual, etiqueta o nombre antiguo).
// Devuelve null si no se reconoce.
export function normalizarCategoria(valor: string | null | undefined): CategoriaIncidencia | null {
  if (!valor) return null;
  const directo = CATEGORIAS_INCIDENCIA.find((c) => c.codigo === valor);
  if (directo) return directo.codigo;
  const limpio = sinTildes(valor);
  const porEtiqueta = CATEGORIAS_INCIDENCIA.find((c) => sinTildes(c.etiqueta) === limpio);
  if (porEtiqueta) return porEtiqueta.codigo;
  return EQUIVALENCIAS[limpio] ?? null;
}

export function etiquetaCategoria(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const codigo = normalizarCategoria(valor);
  return codigo ? CATEGORIAS_INCIDENCIA.find((c) => c.codigo === codigo)!.etiqueta : valor;
}
