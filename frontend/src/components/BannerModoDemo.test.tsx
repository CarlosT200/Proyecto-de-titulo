import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { CONFIG_CARGANDO, CONFIG_DEMO, CONFIG_REAL, CONFIG_SIN_RESPUESTA, renderizarConProveedores } from "../test/proveedores";
import { BannerModoDemo } from "./BannerModoDemo";

describe("BannerModoDemo", () => {
  it("se muestra solo cuando el servidor confirma el modo demostración del SOS", () => {
    renderizarConProveedores(<BannerModoDemo />, { config: CONFIG_DEMO });
    const banner = screen.getByTestId("banner-modo-demo");
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveTextContent("Modo demostración");
    expect(banner).toHaveTextContent("no llama");
  });

  it.each([
    ["operación real", CONFIG_REAL],
    ["configuración sin respuesta", CONFIG_SIN_RESPUESTA],
    ["configuración cargando", CONFIG_CARGANDO],
  ])("no se muestra con %s (nunca se asume demo sin confirmación del servidor)", (_caso, config) => {
    renderizarConProveedores(<BannerModoDemo />, { config });
    expect(screen.queryByTestId("banner-modo-demo")).not.toBeInTheDocument();
  });
});
