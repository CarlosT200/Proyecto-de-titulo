import { configDefaults, defineConfig } from "vitest/config";

// Pruebas unitarias. Valores ficticios para que los tests puedan cargar src/config/env.ts sin un
// backend/.env. Ningun test de esta configuracion se conecta a la base: los que usan Prisma lo
// reemplazan con vi.mock. Son fijos a proposito, para que un test nunca apunte a una base real
// por accidente. Las pruebas de integracion (*.int.test.ts) tienen su propia configuracion
// (vitest.integracion.config.ts) y una base de datos solo de pruebas.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "src/**/*.int.test.ts"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/habitasmart_test",
      JWT_SECRET: "secreto-de-prueba-jwt",
      QR_TOKEN_SECRET: "secreto-de-prueba-qr",
      // Sin logs en la salida de las pruebas (las que revisan el log lo activan con vi.stubEnv).
      LOG_LEVEL: "silencio",
    },
  },
});
