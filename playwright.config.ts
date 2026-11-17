import { defineConfig, devices } from "@playwright/test";
import { config as cargarEnv } from "dotenv";
import path from "node:path";

// Pruebas de punta a punta (E2E): el backend COMPILADO sirve el frontend COMPILADO, igual que en
// Render, contra una base de datos SOLO de pruebas (DATABASE_URL_TEST, nombre terminado en _test).
// La base se vacia y se carga con el seed de demostracion antes de correr (e2e/preparar-base.ts).
// El SOS corre SIEMPRE en modo demostracion: ninguna prueba puede abrir una llamada real.
//
// Requisitos: npm run build (frontend y backend). Local: usa el Chrome instalado en el equipo.
// CI: usa el Chromium de Playwright (npx playwright install --with-deps chromium).
cargarEnv({ path: path.join(__dirname, "backend", ".env.test") });

const PUERTO = 4100;
const BASE = `http://localhost:${PUERTO}`;
const url = process.env.DATABASE_URL_TEST;
if (!url || !/\/[A-Za-z0-9_-]*_test(\?.*)?$/.test(url)) {
  throw new Error("Las E2E necesitan DATABASE_URL_TEST apuntando a una base cuyo nombre termine en _test.");
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/preparar-base.ts",
  // Todas las pruebas comparten la misma base: una a la vez, en orden.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]] : [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: BASE,
    locale: "es-CL",
    timezoneId: "America/Santiago",
    viewport: { width: 1366, height: 768 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ...devices["Desktop Chrome"],
    channel: process.env.CI ? undefined : "chrome",
  },
  webServer: {
    command: "node backend/dist/server.js",
    url: `${BASE}/ready`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NODE_ENV: "test",
      PORT: String(PUERTO),
      DATABASE_URL: url,
      JWT_SECRET: "secreto-ficticio-solo-para-pruebas-e2e-32chars",
      QR_TOKEN_SECRET: "otro-secreto-ficticio-solo-para-e2e-32chars",
      APP_URL: BASE,
      CORS_ORIGIN: BASE,
      SOS_MODO_DEMO: "true",
      MOSTRAR_CUENTAS_DEMO: "true",
      LOG_LEVEL: "warn",
    },
  },
});
