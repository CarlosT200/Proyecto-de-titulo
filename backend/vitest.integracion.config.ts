import { defineConfig } from "vitest/config";
import { config as cargarEnv } from "dotenv";

// Pruebas de integracion HTTP: la aplicacion Express REAL (supertest) contra una base PostgreSQL
// SOLO de pruebas. La base se define con DATABASE_URL_TEST (en local, backend/.env.test; en CI,
// una variable del job con el servicio de Postgres) y su nombre DEBE terminar en "_test": cada
// archivo de pruebas vacia todas las tablas antes de empezar.
cargarEnv({ path: ".env.test" });

const url = process.env.DATABASE_URL_TEST;
if (!url) {
  throw new Error(
    "Falta DATABASE_URL_TEST. Define una base de datos SOLO para pruebas (nombre terminado en _test) en backend/.env.test o en el entorno."
  );
}
if (!/\/[A-Za-z0-9_-]*_test(\?.*)?$/.test(url)) {
  throw new Error("DATABASE_URL_TEST debe apuntar a una base cuyo nombre termine en _test (se vacía en cada corrida).");
}

export default defineConfig({
  test: {
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["./src/test/integracion/global.ts"],
    // Todos los archivos comparten la misma base: se corren de a uno.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: url,
      DATABASE_URL_TEST: url,
      JWT_SECRET: "secreto-de-prueba-de-integracion-jwt-32chars",
      QR_TOKEN_SECRET: "secreto-de-prueba-de-integracion-qr-32chars",
      APP_URL: "http://localhost:4000",
      CORS_ORIGIN: "http://localhost:5173",
      // Las pruebas de SOS corren siempre en modo demostracion: nunca hay una llamada real.
      SOS_MODO_DEMO: "true",
      MOSTRAR_CUENTAS_DEMO: "false",
    },
  },
});
