import { Prisma } from "@prisma/client";

// RNF-12: respaldo de la informacion almacenada.
//
// Los scripts scripts/respaldo.ts y scripts/restaurar.ts usan estas funciones. El respaldo se arma
// a partir del propio esquema de Prisma (no de una lista escrita a mano), asi que una tabla nueva
// entra sola en el respaldo y no se puede "olvidar" una.

export const FORMATO_RESPALDO = "habitasmart-respaldo-v1";

export interface ModeloRespaldo {
  nombre: string; // "Usuario"
  delegado: string; // "usuario" (como se llama en el cliente de Prisma)
  camposFecha: string[];
  camposJson: string[];
  dependencias: string[]; // modelos que deben existir antes (claves foraneas)
}

type ModeloDmmf = (typeof Prisma.dmmf.datamodel.models)[number];

export function describirModelos(modelos: readonly ModeloDmmf[] = Prisma.dmmf.datamodel.models): ModeloRespaldo[] {
  return modelos.map((m) => ({
    nombre: m.name,
    delegado: m.name.charAt(0).toLowerCase() + m.name.slice(1),
    camposFecha: m.fields.filter((f) => f.kind === "scalar" && f.type === "DateTime").map((f) => f.name),
    camposJson: m.fields.filter((f) => f.kind === "scalar" && f.type === "Json").map((f) => f.name),
    dependencias: [
      ...new Set(
        m.fields
          .filter((f) => f.kind === "object" && (f.relationFromFields?.length ?? 0) > 0 && f.type !== m.name)
          .map((f) => f.type)
      ),
    ],
  }));
}

// Orden de insercion: cada tabla despues de aquellas de las que depende (clave foranea).
export function ordenarPorDependencias(modelos: ModeloRespaldo[]): ModeloRespaldo[] {
  const pendientes = new Map(modelos.map((m) => [m.nombre, m]));
  const resultado: ModeloRespaldo[] = [];
  const listos = new Set<string>();

  while (pendientes.size > 0) {
    const listosAhora = [...pendientes.values()].filter((m) => m.dependencias.every((d) => listos.has(d)));
    if (listosAhora.length === 0) {
      throw new Error(`Dependencias circulares entre tablas: ${[...pendientes.keys()].join(", ")}`);
    }
    for (const m of listosAhora) {
      resultado.push(m);
      listos.add(m.nombre);
      pendientes.delete(m.nombre);
    }
  }
  return resultado;
}

// JSON.stringify convierte las fechas a texto ISO; al restaurar hay que volver a convertirlas.
export function reconstruirFila(
  fila: Record<string, unknown>,
  modelo: Pick<ModeloRespaldo, "camposFecha" | "camposJson">
): Record<string, unknown> {
  const resultado: Record<string, unknown> = { ...fila };
  for (const campo of modelo.camposFecha) {
    const valor = resultado[campo];
    if (typeof valor === "string") resultado[campo] = new Date(valor);
  }
  for (const campo of modelo.camposJson) {
    // un campo Json "vacio" no se puede escribir como null: Prisma pide DbNull explicito
    if (resultado[campo] === null) resultado[campo] = Prisma.DbNull;
  }
  return resultado;
}

export interface ArchivoRespaldo {
  formato: typeof FORMATO_RESPALDO;
  creadoEn: string;
  conteos: Record<string, number>;
  tablas: Record<string, Record<string, unknown>[]>;
}

export function validarArchivo(contenido: unknown): ArchivoRespaldo {
  const c = contenido as Partial<ArchivoRespaldo> | null;
  if (!c || c.formato !== FORMATO_RESPALDO || !c.tablas || !c.conteos) {
    throw new Error("El archivo no es un respaldo de HabitaSmart (formato desconocido).");
  }
  for (const [tabla, filas] of Object.entries(c.tablas)) {
    if (!Array.isArray(filas) || filas.length !== c.conteos[tabla]) {
      throw new Error(`El respaldo está dañado o incompleto: la tabla ${tabla} no coincide con su conteo.`);
    }
  }
  return c as ArchivoRespaldo;
}
