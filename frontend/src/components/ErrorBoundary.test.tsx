import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";
import { EmptyState, Spinner } from "./ui";

function Rompe({ mensaje }: { mensaje: string }): JSX.Element {
  throw new Error(mensaje);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary (errores globales)", () => {
  it("si una pantalla falla, muestra un mensaje con opción de recargar en vez de una pantalla en blanco", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Rompe mensaje="fallo de render" />
      </ErrorBoundary>
    );
    expect(screen.getByText("Algo salió mal en esta pantalla")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recargar página/ })).toBeInTheDocument();
    // no muestra el detalle técnico del error
    expect(screen.queryByText(/fallo de render/)).not.toBeInTheDocument();
  });

  it("si falla la carga de una pantalla tras un deploy, avisa que hay una versión nueva", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const recargar = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload: recargar } });
    sessionStorage.setItem("habitasmart_recarga_por_chunk", "1"); // ya se recargó una vez: no reintenta
    render(
      <ErrorBoundary>
        <Rompe mensaje="Failed to fetch dynamically imported module: /assets/x.js" />
      </ErrorBoundary>
    );
    expect(screen.getByText("Hay una versión nueva de HabitaSmart")).toBeInTheDocument();
    expect(recargar).not.toHaveBeenCalled();
    sessionStorage.clear();
  });
});

describe("estados de carga y vacíos", () => {
  it("Spinner se anuncia a lectores de pantalla", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
  });

  it("EmptyState muestra título y descripción", () => {
    render(<EmptyState title="Sin encomiendas" description="Cuando llegue una, aparecerá aquí." />);
    expect(screen.getByText("Sin encomiendas")).toBeInTheDocument();
    expect(screen.getByText("Cuando llegue una, aparecerá aquí.")).toBeInTheDocument();
  });
});
