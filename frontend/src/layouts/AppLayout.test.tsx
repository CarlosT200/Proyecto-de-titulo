import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "../context/auth";
import { ThemeProvider } from "../context/ThemeContext";
import { CONFIG_DEMO, CONFIG_REAL, renderizarConProveedores } from "../test/proveedores";
import { AppLayout } from "./AppLayout";
import type { Rol, Usuario } from "../types";

vi.mock("../api/endpoints", () => ({
  notificacionesApi: { listar: vi.fn().mockResolvedValue([]), leer: vi.fn(), leerTodas: vi.fn(), eliminar: vi.fn(), eliminarTodas: vi.fn() },
}));
vi.mock("../lib/push", () => ({ desactivarPush: vi.fn().mockResolvedValue(undefined) }));

function usuario(rol: Rol): Usuario {
  return { id: "u", email: "u@prueba.test", nombre: "Uno", apellido: "Prueba", rol, condominioId: "c", departamentoId: null };
}

let logout: Mock<() => Promise<void>>;

function renderLayout(rol: Rol, config = CONFIG_REAL) {
  logout = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const auth: AuthContextValue = { usuario: usuario(rol), cargando: false, login: vi.fn(), logout, actualizarUsuario: vi.fn() };
  return renderizarConProveedores(
    <ThemeProvider>
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route path="/login" element={<p>Pantalla de login</p>} />
          <Route
            path="/*"
            element={
              <AppLayout nav={[{ to: "/", label: "Inicio", icon: null }]}>
                <p>Contenido</p>
              </AppLayout>
            }
          />
        </Routes>
      </AuthContext.Provider>
    </ThemeProvider>,
    { config }
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("AppLayout por rol", () => {
  it("el botón SOS solo aparece para residentes", async () => {
    const { unmount } = renderLayout("RESIDENTE");
    expect(await screen.findByRole("button", { name: "Emergencia SOS" })).toBeInTheDocument();
    unmount();
    for (const rol of ["ADMIN", "CONSERJE"] as Rol[]) {
      const r = renderLayout(rol);
      expect(screen.queryByRole("button", { name: "Emergencia SOS" })).not.toBeInTheDocument();
      r.unmount();
    }
  });

  it("muestra la franja de modo demostración en cualquier rol cuando el servidor lo indica", () => {
    renderLayout("ADMIN", CONFIG_DEMO);
    expect(screen.getByTestId("banner-modo-demo")).toBeInTheDocument();
  });

  it("la campana incluye en su nombre accesible el número visible de no leídas (WCAG 2.5.3)", async () => {
    const { notificacionesApi } = await import("../api/endpoints");
    vi.mocked(notificacionesApi.listar).mockResolvedValueOnce([
      { id: "n1", tipo: "X", titulo: "Uno", mensaje: "m", leida: false, createdAt: "2026-11-16T10:00:00Z" },
      { id: "n2", tipo: "X", titulo: "Dos", mensaje: "m", leida: false, createdAt: "2026-11-16T10:00:00Z" },
    ] as never);
    renderLayout("ADMIN");
    expect(await screen.findByRole("button", { name: "Notificaciones, 2 sin leer" })).toBeInTheDocument();
  });

  it("«Salir» cierra la sesión en el servidor y vuelve al login", async () => {
    const user = userEvent.setup();
    renderLayout("CONSERJE");
    await user.click(screen.getByRole("button", { name: "Salir" }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Pantalla de login")).toBeInTheDocument();
  });
});
