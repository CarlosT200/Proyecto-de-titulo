import { execFileSync } from "node:child_process";
import path from "node:path";

// Se ejecuta UNA vez antes de todas las pruebas de integracion: aplica las migraciones a la base
// de pruebas (la misma secuencia que corre en produccion con "prisma migrate deploy").
export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url || !/_test(\?.*)?$/.test(url)) {
    throw new Error("DATABASE_URL_TEST debe apuntar a una base cuyo nombre termine en _test.");
  }
  const prisma = path.join(__dirname, "..", "..", "..", "..", "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prisma, "migrate", "deploy"], {
    cwd: path.join(__dirname, "..", "..", ".."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
