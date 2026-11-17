// RNF-12: crea un respaldo completo de la base de datos en un archivo comprimido (.json.gz).
//
// Uso (desde la carpeta backend):
//   npm run respaldo
//   npm run respaldo -- mi-respaldo.json.gz
//
// Usa la base de datos de DATABASE_URL (backend/.env). Para respaldar la de produccion (Supabase),
// pasar su cadena de conexion solo para ese comando, sin guardarla en ningun archivo ni en el
// historial: ver el procedimiento exacto en docs/OPERACION.md §4.
//
// El respaldo incluye TODAS las tablas del esquema de Prisma de ESTE codigo. Por eso el codigo y la
// base deben estar en la misma version de migraciones:
// - Antes de mergear un PR con migraciones nuevas (por ejemplo la Fase 2, que agrega "sesiones"),
//   la base de produccion aun no las tiene: el respaldo previo se hace con el codigo de main (o con
//   pg_dump), no con el de la rama. Si se intenta con el de la rama, el script se DETIENE antes de
//   leer nada e indica que tabla falta; nunca la salta ni deja un respaldo incompleto.
// - Despues del deploy (migraciones aplicadas), este script respalda tambien "sesiones".
//
// IMPORTANTE: el archivo contiene datos personales y contraseñas cifradas. Guardarlo en un lugar
// privado; no subirlo a GitHub (la carpeta respaldos/ ya esta ignorada por git).

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { PrismaClient } from "@prisma/client";
import {
  ArchivoRespaldo,
  describirModelos,
  FORMATO_RESPALDO,
  ordenarPorDependencias,
  verificarTablasDelEsquema,
} from "../src/lib/respaldo";

const prisma = new PrismaClient({ log: ["error"] });

function nombreDeArchivo(): string {
  const argumento = process.argv[2];
  if (argumento) return argumento;
  const ahora = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  const marca = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}-${dos(ahora.getHours())}${dos(ahora.getMinutes())}`;
  return path.join("respaldos", `respaldo-${marca}.json.gz`);
}

async function main() {
  const modelos = ordenarPorDependencias(describirModelos());
  // El esquema del codigo debe coincidir con la base (si no, se detiene: ver el comentario de arriba).
  const tablasDeLaBase = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`;
  verificarTablasDelEsquema(modelos, tablasDeLaBase.map((t) => t.tablename));

  const tablas: ArchivoRespaldo["tablas"] = {};
  const conteos: ArchivoRespaldo["conteos"] = {};

  // Una sola transaccion de lectura: todas las tablas salen del mismo instante, aunque alguien
  // este usando la aplicacion mientras se respalda.
  await prisma.$transaction(
    async (tx) => {
      for (const modelo of modelos) {
        const delegado = (tx as unknown as Record<string, { findMany: () => Promise<Record<string, unknown>[]> }>)[
          modelo.delegado
        ];
        const filas = await delegado.findMany();
        tablas[modelo.nombre] = filas;
        conteos[modelo.nombre] = filas.length;
      }
    },
    { timeout: 120_000, maxWait: 30_000 }
  );

  const contenido: ArchivoRespaldo = { formato: FORMATO_RESPALDO, creadoEn: new Date().toISOString(), conteos, tablas };
  const destino = nombreDeArchivo();
  fs.mkdirSync(path.dirname(path.resolve(destino)), { recursive: true });
  fs.writeFileSync(destino, zlib.gzipSync(Buffer.from(JSON.stringify(contenido), "utf-8")));

  const total = Object.values(conteos).reduce((a, b) => a + b, 0);
  const kb = Math.round(fs.statSync(destino).size / 1024);
  console.log(`Respaldo creado: ${path.resolve(destino)} (${kb} KB, ${total} registros)`);
  for (const [tabla, n] of Object.entries(conteos)) if (n > 0) console.log(`  ${tabla}: ${n}`);
}

main()
  .catch((error) => {
    console.error("No se pudo crear el respaldo:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
