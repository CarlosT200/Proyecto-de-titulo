import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Las librerias base van en archivos propios: cambian muy poco entre versiones de la app, asi que el
// navegador las conserva en cache (los /assets se sirven como inmutables) y en cada actualizacion
// solo se descarga el codigo propio, que es lo que cambia.
function separarLibrerias(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "react";
  if (/node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return "animaciones";
  if (/node_modules[\\/]@phosphor-icons[\\/]/.test(id)) return "iconos";
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: { manualChunks: separarLibrerias },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
