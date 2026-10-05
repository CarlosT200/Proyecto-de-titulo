import { defineConfig } from "vitest/config";

// Valores ficticios para que los tests puedan cargar src/config/env.ts sin un backend/.env.
// Ningun test se conecta a la base: los que usan Prisma lo reemplazan con vi.mock.
// Son fijos a proposito, para que un test nunca apunte a una base real por accidente.
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/habitasmart_test",
      JWT_SECRET: "secreto-de-prueba-jwt",
      QR_TOKEN_SECRET: "secreto-de-prueba-qr",
    },
  },
});
