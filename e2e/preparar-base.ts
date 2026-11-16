import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Antes de las E2E: aplica las migraciones a la base de pruebas, la vacia y carga el seed de
// demostracion (datos ficticios, siempre los mismos). Doble guardia: solo bases "_test".
export default async function prepararBase() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url || !/\/[A-Za-z0-9_-]*_test(\?.*)?$/.test(url)) {
    throw new Error("DATABASE_URL_TEST debe apuntar a una base cuyo nombre termine en _test.");
  }
  const raiz = path.join(__dirname, "..");
  const backend = path.join(raiz, "backend");
  const env = { ...process.env, DATABASE_URL: url, LOG_LEVEL: "warn" };

  execFileSync(process.execPath, [path.join(raiz, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
    cwd: backend,
    env,
    stdio: "inherit",
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    if (tablas.length) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tablas.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }

  execFileSync(process.execPath, [path.join(raiz, "node_modules", "ts-node", "dist", "bin.js"), "prisma/seed.ts"], {
    cwd: backend,
    env,
    stdio: "inherit",
  });
}
