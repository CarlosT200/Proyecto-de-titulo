import type { ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../context/ToastContext";
import { ConfirmProvider } from "../context/ConfirmContext";
import { ConfigPublicaContext, type EstadoConfigPublica } from "../context/configPublica";

// Estados de configuracion publica listos para usar en las pruebas.
export const CONFIG_DEMO: EstadoConfigPublica = { estado: "ok", config: { cuentasDemo: true, sosModoDemo: true } };
export const CONFIG_REAL: EstadoConfigPublica = { estado: "ok", config: { cuentasDemo: false, sosModoDemo: false } };
export const CONFIG_SIN_RESPUESTA: EstadoConfigPublica = { estado: "error", config: null };
export const CONFIG_CARGANDO: EstadoConfigPublica = { estado: "cargando", config: null };

interface OpcionesRender extends Omit<RenderOptions, "wrapper"> {
  config?: EstadoConfigPublica;
  rutaInicial?: string;
}

// Renderiza un componente con los mismos proveedores que main.tsx (menos AuthProvider y el tema,
// que cada prueba monta solo si los necesita).
export function renderizarConProveedores(ui: ReactNode, { config = CONFIG_REAL, rutaInicial = "/", ...opciones }: OpcionesRender = {}) {
  function Proveedores({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[rutaInicial]}>
        <ConfigPublicaContext.Provider value={config}>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </ConfigPublicaContext.Provider>
      </MemoryRouter>
    );
  }
  return render(ui, { wrapper: Proveedores, ...opciones });
}
