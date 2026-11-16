import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONFIG_CARGANDO, CONFIG_DEMO, CONFIG_REAL, CONFIG_SIN_RESPUESTA, renderizarConProveedores } from "../test/proveedores";
import { BotonSOS } from "./BotonSOS";

// Se reemplazan SOLO las dos funciones con efectos reales: el envio del aviso (red) y la apertura
// de la llamada ("tel:"). Asi la prueba comprueba, para cada modo, si se llamo o no a cada una.
vi.mock("../lib/sos", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/sos")>();
  return { ...real, enviarAlertaSos: vi.fn(), abrirLlamada: vi.fn(), BLOQUEO_TRAS_LLAMADA_MS: 60 };
});

import { abrirLlamada, enviarAlertaSos } from "../lib/sos";

const enviar = vi.mocked(enviarAlertaSos);
const llamar = vi.mocked(abrirLlamada);

async function abrirMenuSos(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Emergencia SOS" }));
  return screen.findByRole("dialog", { name: "Emergencia" });
}

beforeEach(() => {
  enviar.mockResolvedValue(undefined);
});

describe("BotonSOS — modo demostración", () => {
  it("avisa al servidor, espera la respuesta y NUNCA abre una llamada real", async () => {
    const user = userEvent.setup();
    renderizarConProveedores(<BotonSOS />, { config: CONFIG_DEMO });
    const dialogo = await abrirMenuSos(user);

    expect(within(dialogo).getByTestId("sos-aviso-modo")).toHaveTextContent("Modo demostración");
    await user.click(within(dialogo).getByRole("button", { name: /Bomberos/ }));

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledWith("BOMBEROS");
    expect(llamar).not.toHaveBeenCalled();
    expect(await screen.findByText(/el aviso se envió a conserjería y administración/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Emergencia" })).not.toBeInTheDocument());
  });

  it("si el servidor falla, muestra el error real (no un 'se avisó' optimista) y tampoco llama", async () => {
    enviar.mockRejectedValue(new Error("No se pudo enviar la alerta."));
    const user = userEvent.setup();
    renderizarConProveedores(<BotonSOS />, { config: CONFIG_DEMO });
    const dialogo = await abrirMenuSos(user);

    await user.click(within(dialogo).getByRole("button", { name: /Ambulancia/ }));

    expect(await screen.findByText(/no se pudo enviar el aviso/)).toBeInTheDocument();
    expect(llamar).not.toHaveBeenCalled();
    // El menu sigue abierto para reintentar.
    expect(screen.getByRole("dialog", { name: "Emergencia" })).toBeInTheDocument();
  });

  it("muestra el progreso en el boton tocado y bloquea los demas mientras espera; un doble clic envía una sola vez", async () => {
    let terminar: () => void = () => {};
    enviar.mockReturnValue(new Promise<void>((resolve) => (terminar = resolve)));
    const user = userEvent.setup();
    renderizarConProveedores(<BotonSOS />, { config: CONFIG_DEMO });
    const dialogo = await abrirMenuSos(user);

    const bomberos = within(dialogo).getByRole("button", { name: /Bomberos/ });
    await user.dblClick(bomberos);

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(bomberos).toHaveAttribute("aria-busy", "true");
    expect(bomberos).toHaveTextContent("Enviando aviso…");
    expect(within(dialogo).getByRole("button", { name: /Carabineros/ })).toBeDisabled();
    expect(within(dialogo).getByRole("button", { name: /Ambulancia/ })).toBeDisabled();

    terminar();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Emergencia" })).not.toBeInTheDocument());
    expect(llamar).not.toHaveBeenCalled();
  });
});

describe("BotonSOS — operación real", () => {
  it("abre la llamada de inmediato y envía el aviso como mejor esfuerzo, sin esperar respuesta", async () => {
    // El aviso queda pendiente para siempre: la llamada no debe depender de el.
    enviar.mockReturnValue(new Promise<void>(() => {}));
    const user = userEvent.setup();
    renderizarConProveedores(<BotonSOS />, { config: CONFIG_REAL });
    const dialogo = await abrirMenuSos(user);

    expect(within(dialogo).getByTestId("sos-aviso-modo")).toHaveTextContent("abrirá la llamada real");
    await user.click(within(dialogo).getByRole("button", { name: /Carabineros/ }));

    expect(llamar).toHaveBeenCalledTimes(1);
    expect(llamar).toHaveBeenCalledWith("133");
    expect(enviar).toHaveBeenCalledWith("CARABINEROS");
    const aviso = await screen.findByText(/Abriendo la llamada de emergencia a 133/);
    // Mejor esfuerzo: se dice que "se está avisando", nunca que el aviso llegó.
    expect(aviso).toHaveTextContent("se está avisando");
    expect(aviso).not.toHaveTextContent(/se avisó|garantiz/);
  });

  it("un doble toque abre la llamada una sola vez y manda un solo aviso", async () => {
    const user = userEvent.setup();
    renderizarConProveedores(<BotonSOS />, { config: CONFIG_REAL });
    const dialogo = await abrirMenuSos(user);

    await user.dblClick(within(dialogo).getByRole("button", { name: /Bomberos/ }));

    expect(llamar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});

describe("BotonSOS — modo indeterminado (la configuración no cargó)", () => {
  it.each([
    ["falló", CONFIG_SIN_RESPUESTA],
    ["todavía está cargando", CONFIG_CARGANDO],
  ])("si la configuración %s, pide confirmación y al cancelar no llama ni avisa", async (_caso, config) => {
    const user = userEvent.setup();
    renderizarConProveedores(<BotonSOS />, { config });
    const dialogo = await abrirMenuSos(user);

    expect(within(dialogo).getByTestId("sos-aviso-modo")).toHaveTextContent("No se pudo determinar el modo");
    await user.click(within(dialogo).getByRole("button", { name: /Ambulancia/ }));

    const confirmacion = await screen.findByRole("dialog", { name: "Confirmar llamada de emergencia" });
    expect(confirmacion).toHaveTextContent("131");
    await user.click(within(confirmacion).getByRole("button", { name: "Cancelar" }));

    expect(llamar).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
  });

  it("solo abre el número real si la persona confirma explícitamente", async () => {
    const user = userEvent.setup();
    renderizarConProveedores(<BotonSOS />, { config: CONFIG_SIN_RESPUESTA });
    const dialogo = await abrirMenuSos(user);

    await user.click(within(dialogo).getByRole("button", { name: /Carabineros/ }));
    const confirmacion = await screen.findByRole("dialog", { name: "Confirmar llamada de emergencia" });
    await user.click(within(confirmacion).getByRole("button", { name: "Llamar 133" }));

    expect(llamar).toHaveBeenCalledWith("133");
    expect(enviar).toHaveBeenCalledWith("CARABINEROS");
  });
});
