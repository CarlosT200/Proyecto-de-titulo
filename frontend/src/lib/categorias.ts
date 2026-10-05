import {
  Car,
  Drop,
  Dog,
  Elevator,
  Bug,
  Door,
  Lightning,
  Plant,
  ShieldCheck,
  SpeakerHigh,
  Broom,
  Wall,
  DotsThreeCircle,
  Icon as PhosphorIcon,
} from "@phosphor-icons/react";

// Categorias de incidencias: copia exacta de backend/src/lib/categorias.ts (si se cambia alla,
// cambiarla aqui). Se guarda el codigo; las incidencias antiguas tienen texto libre y se traducen
// con normalizarCategoria().
export const CATEGORIAS_INCIDENCIA: { codigo: string; etiqueta: string; icono: PhosphorIcon }[] = [
  { codigo: "AGUA", etiqueta: "Agua y filtraciones", icono: Drop },
  { codigo: "ELECTRICIDAD", etiqueta: "Electricidad", icono: Lightning },
  { codigo: "ASCENSOR", etiqueta: "Ascensor", icono: Elevator },
  { codigo: "PUERTAS_ACCESOS", etiqueta: "Puertas y accesos", icono: Door },
  { codigo: "INFRAESTRUCTURA", etiqueta: "Muros, techos y pisos", icono: Wall },
  { codigo: "LIMPIEZA", etiqueta: "Limpieza y basura", icono: Broom },
  { codigo: "PLAGAS", etiqueta: "Plagas", icono: Bug },
  { codigo: "RUIDOS", etiqueta: "Ruidos molestos", icono: SpeakerHigh },
  { codigo: "ESTACIONAMIENTO", etiqueta: "Estacionamiento", icono: Car },
  { codigo: "AREAS_VERDES", etiqueta: "Áreas verdes", icono: Plant },
  { codigo: "SEGURIDAD", etiqueta: "Seguridad", icono: ShieldCheck },
  { codigo: "MASCOTAS", etiqueta: "Mascotas", icono: Dog },
  { codigo: "OTROS", etiqueta: "Otros", icono: DotsThreeCircle },
];

const EQUIVALENCIAS: Record<string, string> = {
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

export function normalizarCategoria(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (CATEGORIAS_INCIDENCIA.some((c) => c.codigo === valor)) return valor;
  const limpio = sinTildes(valor);
  const porEtiqueta = CATEGORIAS_INCIDENCIA.find((c) => sinTildes(c.etiqueta) === limpio);
  if (porEtiqueta) return porEtiqueta.codigo;
  return EQUIVALENCIAS[limpio] ?? null;
}

// Etiqueta para mostrar; si es un texto antiguo que no se reconoce, se muestra tal cual.
export function etiquetaCategoria(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const codigo = normalizarCategoria(valor);
  return codigo ? CATEGORIAS_INCIDENCIA.find((c) => c.codigo === codigo)!.etiqueta : valor;
}

export function iconoCategoria(valor: string | null | undefined): PhosphorIcon {
  const codigo = normalizarCategoria(valor);
  return CATEGORIAS_INCIDENCIA.find((c) => c.codigo === codigo)?.icono ?? DotsThreeCircle;
}
