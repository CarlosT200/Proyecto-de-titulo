import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Desmonta lo renderizado despues de cada prueba (sin "globals" hay que hacerlo a mano).
afterEach(() => {
  cleanup();
});

// jsdom no implementa matchMedia; varios componentes lo usan para distinguir celular de escritorio
// y para "reducir movimiento". Por defecto: pantalla de escritorio y sin preferencia de movimiento.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("min-width"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (typeof window !== "undefined" && typeof window.scrollTo !== "function") {
  Object.defineProperty(window, "scrollTo", { writable: true, value: vi.fn() });
}
