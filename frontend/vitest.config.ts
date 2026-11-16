import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Pruebas de frontend (Vitest + Testing Library) sobre jsdom. Reusa la configuracion de Vite
// (plugin de React) para que los componentes se transformen igual que en la app.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
      clearMocks: true,
    },
  })
);
