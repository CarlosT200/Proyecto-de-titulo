// RNF-12: carga un respaldo creado con scripts/respaldo.ts en una base de datos VACIA.
//
// Uso (desde la carpeta backend), con la base nueva ya migrada (npm run prisma:migrate:deploy):
//   npm run restaurar -- respaldos/respaldo-20261003-1700.json.gz
//
// Por seguridad se niega a escribir si la base de destino ya tiene datos: restaurar encima de una
// base en uso mezclaria registros. Al terminar compara los conteos con los del respaldo.

import fs from "node:fs";
import zlib from "node:zlib";
import { PrismaClient } from "@prisma/client";
import { describirModelos, ordenarPorDependencias, reconstruirFila, validarArchivo } from "../src/lib/respaldo";

const prisma = new PrismaClient({ log: ["error"] });
const LOTE = 25; // filas con fotos y documentos en base64 pesan: lotes chicos

type Delegado = {
  count: () => Promise<number>;
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<{ count: number }>;
};

async function main() {
  const ruta = process.argv[2];
  if (!ruta) throw new Error("Indica el archivo: npm run restaurar -- respaldos/respaldo-XXXX.json.gz");

  const bytes = fs.readFileSync(ruta);
  const texto = (bytes[0] === 0x1f && bytes[1] === 0x8b ? zlib.gunzipSync(bytes) : bytes).toString("utf-8");
  const respaldo = validarArchivo(JSON.parse(texto));
  console.log(`Respaldo del ${respaldo.creadoEn}`);

  const modelos = ordenarPorDependencias(describirModelos());
  const delegados = prisma as unknown as Record<string, Delegado>;

  for (const modelo of modelos) {
    const existentes = await delegados[modelo.delegado].count();
    if (existentes > 0) {
      throw new Error(
        `La base de destino no está vacía (${modelo.nombre} tiene ${existentes} registros). ` +
          "Restaura sobre una base nueva, recién migrada."
      );
    }
  }

  for (const modelo of modelos) {
    const filas = respaldo.tablas[modelo.nombre] ?? [];
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE).map((f) => reconstruirFila(f, modelo));
      await delegados[modelo.delegado].createMany({ data: lote });
    }
    if (filas.length > 0) console.log(`  ${modelo.nombre}: ${filas.length}`);
  }

  // Verificacion: lo que quedo en la base tiene que ser igual a lo que decia el respaldo.
  const diferencias: string[] = [];
  for (const modelo of modelos) {
    const esperado = respaldo.conteos[modelo.nombre] ?? 0;
    const real = await delegados[modelo.delegado].count();
    if (real !== esperado) diferencias.push(`${modelo.nombre}: respaldo ${esperado}, base ${real}`);
  }
  if (diferencias.length > 0) throw new Error(`La restauración no coincide con el respaldo:\n  ${diferencias.join("\n  ")}`);
  console.log("Restauración completa: todos los conteos coinciden con el respaldo.");
}

main()
  .catch((error) => {
    console.error("No se pudo restaurar:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
