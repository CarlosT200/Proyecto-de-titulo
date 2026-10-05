// HU-25: clasificacion asistida de incidencias.
// Motor de reglas por palabras clave (MVP, sin dependencia de un servicio externo de pago): no usa
// ningun modelo de lenguaje, solo reconoce palabras. El resultado es una clasificacion inicial que
// la administracion puede revisar y cambiar siempre (RNF-14); nunca bloquea el reporte.
//
// REGLAS: para ajustar el clasificador basta con editar las tablas de este archivo (palabras por
// categoria, palabras de prioridad alta o baja y ubicaciones). Las palabras se escriben sin tildes y
// en singular: la comparacion ignora tildes y mayusculas y acepta plurales.

import { PrioridadIncidencia } from "@prisma/client";
import type { CategoriaIncidencia } from "../../lib/categorias";

// Orden = desempate: si dos categorias tienen las mismas coincidencias, gana la que esta antes.
const PALABRAS_POR_CATEGORIA: [Exclude<CategoriaIncidencia, "OTROS">, string[]][] = [
  [
    "AGUA",
    [
      "agua",
      "filtracion",
      "fuga de agua",
      "gotera",
      "goteo",
      "gotea",
      "inundacion",
      "inundado",
      "humedad",
      "cañeria",
      "desague",
      "alcantarillado",
      "sin agua",
    ],
  ],
  [
    "ELECTRICIDAD",
    ["electrico", "electricidad", "cortocircuito", "chispa", "enchufe", "cable", "luz", "luces", "ampolleta", "luminaria", "apagon", "sin luz"],
  ],
  ["ASCENSOR", ["ascensor", "elevador"]],
  [
    "PUERTAS_ACCESOS",
    ["puerta", "porton", "cerradura", "chapa", "citofono", "control remoto", "reja", "barrera", "acceso"],
  ],
  ["INFRAESTRUCTURA", ["grieta", "estructural", "derrumbe", "techo", "muro", "pared", "baldosa", "escalera"]],
  ["LIMPIEZA", ["basura", "suciedad", "sucio", "limpieza", "mal olor", "desecho", "reciclaje"]],
  ["PLAGAS", ["plaga", "roedor", "rata", "raton", "cucaracha", "insecto", "termita", "chinche", "palomas"]],
  ["RUIDOS", ["ruido", "musica", "fiesta", "molestia auditiva", "grito"]],
  ["ESTACIONAMIENTO", ["estacionamiento", "estacionado", "auto", "vehiculo", "patente", "bicicletero"]],
  ["AREAS_VERDES", ["jardin", "pasto", "cesped", "arbol", "planta", "riego", "poda", "area verde"]],
  ["SEGURIDAD", ["robo", "robaron", "intruso", "sospechoso", "camara", "alarma", "vandalismo", "seguridad"]],
  ["MASCOTAS", ["perro", "gato", "mascota", "ladrido", "excremento"]],
];

// Cualquiera de estas sube la prioridad a ALTA (riesgo para personas o daño que crece con el tiempo).
const PALABRAS_PRIORIDAD_ALTA = [
  "urgente",
  "emergencia",
  "peligro",
  "riesgo",
  "grave",
  "incendio",
  "fuego",
  "humo",
  "gas",
  "cortocircuito",
  "chispa",
  "electrocutado",
  "descarga electrica",
  "atrapado",
  "atrapada",
  "ascensor detenido",
  "inundacion",
  "inundado",
  "inundada",
  "sale agua",
  "saliendo agua",
  "cae agua",
  "cayendo agua",
  "corre agua",
  "derrumbe",
];

// Sin ninguna de alta, estas bajan la prioridad a BAJA.
const PALABRAS_PRIORIDAD_BAJA = [
  "menor",
  "leve",
  "pequeña",
  "pequeño",
  "detalle",
  "estetico",
  "cuando puedan",
  "sin apuro",
  "no es urgente",
  "no urgente",
  "nada urgente",
];

// Frases que niegan la urgencia: se quitan antes de buscar palabras de prioridad alta
// ("no es urgente" no puede contar como "urgente").
const NEGACIONES_DE_URGENCIA = [
  "no es urgente",
  "no urgente",
  "nada urgente",
  "no es grave",
  "nada grave",
  "no es peligroso",
  "sin peligro",
  "sin riesgo",
  "no hay peligro",
  "no hay riesgo",
];

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

// La palabra (o frase) tiene que aparecer completa y puede venir en plural: "gas" no coincide con
// "gasfiter" ni con "gastos comunes", y "grietas" si coincide con "grieta".
const cacheRegex = new Map<string, RegExp>();
function regexDePalabra(palabra: string, global = false): RegExp {
  const clave = `${normalizar(palabra)}|${global ? "g" : ""}`;
  let regex = cacheRegex.get(clave);
  if (!regex) {
    const partes = normalizar(palabra)
      .split(/\s+/)
      .map((p) => `${escaparRegex(p)}(?:s|es)?`);
    regex = new RegExp(`(?<![a-z0-9])${partes.join("\\s+")}(?![a-z0-9])`, global ? "g" : "");
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

function quitarNegaciones(texto: string): string {
  return NEGACIONES_DE_URGENCIA.reduce((t, frase) => t.replace(regexDePalabra(frase, true), " "), texto);
}

export interface SugerenciaIA {
  categoria: CategoriaIncidencia;
  prioridad: PrioridadIncidencia;
  ubicacionDetectada: string | null;
  confianza: "baja" | "media" | "alta";
}

export function sugerirClasificacion(titulo: string, descripcion: string, ubicacionIngresada: string): SugerenciaIA {
  const texto = normalizar(`${titulo} ${descripcion} ${ubicacionIngresada}`);

  let categoria: CategoriaIncidencia = "OTROS";
  let coincidenciasCategoria = 0;
  for (const [codigo, palabras] of PALABRAS_POR_CATEGORIA) {
    const coincidencias = unicas(palabras).filter((p) => contiene(texto, p)).length;
    if (coincidencias > coincidenciasCategoria) {
      coincidenciasCategoria = coincidencias;
      categoria = codigo;
    }
  }

  let prioridad: PrioridadIncidencia = PrioridadIncidencia.MEDIA;
  const textoSinNegaciones = quitarNegaciones(texto);
  if (unicas(PALABRAS_PRIORIDAD_ALTA).some((p) => contiene(textoSinNegaciones, p))) {
    prioridad = PrioridadIncidencia.ALTA;
  } else if (unicas(PALABRAS_PRIORIDAD_BAJA).some((p) => contiene(texto, p))) {
    prioridad = PrioridadIncidencia.BAJA;
  }

  // La ubicacion que escribio la persona manda; si no reconoce ninguna, se busca en el resto del
  // texto y gana la que aparece primero.
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
