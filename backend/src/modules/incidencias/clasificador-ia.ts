// HU-25: clasificacion asistida de incidencias.
// Motor de reglas por palabras clave (MVP, sin dependencia de un servicio externo de pago): no usa
// ningun modelo de lenguaje, solo reconoce palabras. El resultado es SIEMPRE una sugerencia: el
// administrador debe revisarla y puede modificarla (RNF-14).

import { PrioridadIncidencia } from "@prisma/client";

interface ReglaCategoria {
  categoria: string;
  palabras: string[];
}

const CATEGORIAS: ReglaCategoria[] = [
  {
    categoria: "Filtración",
    palabras: ["filtracion", "fuga de agua", "gotera", "goteo", "inundacion", "inundado", "humedad", "cañeria rota"],
  },
  {
    categoria: "Eléctrico",
    palabras: ["electrico", "cortocircuito", "chispa", "enchufe", "cable", "luz", "ampolleta", "luminaria", "apagon"],
  },
  { categoria: "Ascensor", palabras: ["ascensor", "elevador", "atrapado", "atrapada"] },
  { categoria: "Plaga", palabras: ["plaga", "roedor", "rata", "raton", "cucaracha", "insecto"] },
  { categoria: "Seguridad", palabras: ["robo", "intruso", "camara", "portón", "cerradura", "seguridad"] },
  { categoria: "Ruido", palabras: ["ruido", "musica", "fiesta", "molestia auditiva"] },
  { categoria: "Estructural", palabras: ["grieta", "estructural", "derrumbe", "techo", "muro"] },
  { categoria: "Limpieza", palabras: ["basura", "suciedad", "limpieza", "olor"] },
];

const PALABRAS_PRIORIDAD_ALTA = [
  "urgente",
  "grande",
  "importante",
  "incendio",
  "humo",
  "gas",
  "peligro",
  "emergencia",
  "grave",
  "riesgo",
  "atrapado",
  "atrapada",
];

const PALABRAS_PRIORIDAD_BAJA = ["menor", "leve", "pequeña", "detalle", "estético"];

// [lo que se busca en el texto, como se muestra]
const UBICACIONES_CONOCIDAS: [string, string][] = [
  ["estacionamiento", "Estacionamiento"],
  ["subterraneo", "Subterráneo"],
  ["ascensor", "Ascensor"],
  ["pasillo", "Pasillo"],
  ["terraza", "Terraza"],
  ["piscina", "Piscina"],
  ["gimnasio", "Gimnasio"],
  ["hall", "Hall"],
  ["azotea", "Azotea"],
  ["bodega", "Bodega"],
  ["quincho", "Quincho"],
  ["sala de eventos", "Sala de eventos"],
  ["lavanderia", "Lavandería"],
  ["jardin", "Jardín"],
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// La palabra (o frase) tiene que aparecer completa y puede venir en plural: "gas" ya no coincide
// con "gasfiter" ni con "gastos comunes", y "grietas" si coincide con "grieta".
const cacheRegex = new Map<string, RegExp>();
function regexDePalabra(palabra: string): RegExp {
  const clave = normalizar(palabra);
  let regex = cacheRegex.get(clave);
  if (!regex) {
    const partes = clave.split(/\s+/).map((p) => `${escaparRegex(p)}(?:s|es)?`);
    regex = new RegExp(`(?<![a-z0-9ñ])${partes.join("\\s+")}(?![a-z0-9ñ])`);
    cacheRegex.set(clave, regex);
  }
  return regex;
}

// Palabras distintas ya normalizadas: "portón" y "porton" son la misma, no dos coincidencias.
function unicas(palabras: string[]): string[] {
  return [...new Set(palabras.map(normalizar))];
}

function contiene(texto: string, palabra: string): boolean {
  return regexDePalabra(palabra).test(texto);
}

export interface SugerenciaIA {
  categoria: string;
  prioridad: PrioridadIncidencia;
  ubicacionDetectada: string | null;
  confianza: "baja" | "media" | "alta";
}

export function sugerirClasificacion(titulo: string, descripcion: string, ubicacionIngresada: string): SugerenciaIA {
  const texto = normalizar(`${titulo} ${descripcion} ${ubicacionIngresada}`);

  let categoria = "Otro";
  let coincidenciasCategoria = 0;
  for (const regla of CATEGORIAS) {
    const coincidencias = unicas(regla.palabras).filter((p) => contiene(texto, p)).length;
    if (coincidencias > coincidenciasCategoria) {
      coincidenciasCategoria = coincidencias;
      categoria = regla.categoria;
    }
  }

  let prioridad: PrioridadIncidencia = PrioridadIncidencia.MEDIA;
  if (unicas(PALABRAS_PRIORIDAD_ALTA).some((p) => contiene(texto, p))) {
    prioridad = PrioridadIncidencia.ALTA;
  } else if (unicas(PALABRAS_PRIORIDAD_BAJA).some((p) => contiene(texto, p))) {
    prioridad = PrioridadIncidencia.BAJA;
  }

  // La ubicacion que escribio la persona manda; si no reconoce ninguna, se busca en el resto del
  // texto y gana la que aparece primero (antes ganaba la primera de la lista: "subterraneo" le
  // ganaba a "bodega" aunque la persona hubiera escrito "bodega" primero).
  const ubicacionDetectada =
    ubicacionMasTemprana(normalizar(ubicacionIngresada)) ??
    ubicacionMasTemprana(normalizar(`${titulo} ${descripcion}`)) ??
    (ubicacionIngresada || null);

  const confianza: SugerenciaIA["confianza"] =
    coincidenciasCategoria >= 2 ? "alta" : coincidenciasCategoria === 1 ? "media" : "baja";

  return { categoria, prioridad, ubicacionDetectada, confianza };
}

function ubicacionMasTemprana(texto: string): string | null {
  let mejor: { posicion: number; etiqueta: string } | null = null;
  for (const [clave, etiqueta] of UBICACIONES_CONOCIDAS) {
    const posicion = texto.search(regexDePalabra(clave));
    if (posicion >= 0 && (!mejor || posicion < mejor.posicion)) mejor = { posicion, etiqueta };
  }
  return mejor?.etiqueta ?? null;
}
