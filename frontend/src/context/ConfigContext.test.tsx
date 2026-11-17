import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ConfigPublicaProvider } from "./ConfigContext";
import { useConfigPublica } from "./configPublica";

vi.mock("../api/client", () => ({ api: { get: vi.fn() } }));

import { api } from "../api/client";

const get = vi.mocked(api.get);

function Lector() {
  const c = useConfigPublica();
  return <p data-testid="estado">{c.estado === "ok" ? `ok:${c.config.sosModoDemo ? "demo" : "real"}` : c.estado}</p>;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ConfigPublicaProvider", () => {
  it("entrega la configuración del servidor y normaliza valores faltantes a false", async () => {
    get.mockResolvedValue({ data: { sosModoDemo: true } });
    render(
      <ConfigPublicaProvider>
        <Lector />
      </ConfigPublicaProvider>
    );
    expect(screen.getByTestId("estado")).toHaveTextContent("cargando");
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("estado")).toHaveTextContent("ok:demo");
    expect(get).toHaveBeenCalledWith("/config");
  });

  it("si falla queda en 'error' (nunca asume un modo) y reintenta con espera creciente", async () => {
    get.mockRejectedValueOnce(new Error("sin red")).mockRejectedValueOnce(new Error("sin red")).mockResolvedValue({ data: { sosModoDemo: false } });
    render(
      <ConfigPublicaProvider>
        <Lector />
      </ConfigPublicaProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("estado")).toHaveTextContent("error");
    expect(get).toHaveBeenCalledTimes(1);

    // Primer reintento a los 2 s: vuelve a fallar.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("estado")).toHaveTextContent("error");

    // Segundo reintento a los 5 s: responde.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(get).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId("estado")).toHaveTextContent("ok:real");
  });
});
