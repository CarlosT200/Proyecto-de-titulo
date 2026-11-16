import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "../context/auth";
import { renderizarConProveedores } from "../test/proveedores";
import { ProtectedRoute } from "./ProtectedRoute";
import type { Rol, Usuario } from "../types";

vi.mock("../api/endpoints", () => ({ authApi: { cambiarPassword: vi.fn() } }));

function usuario(rol: Rol, extra: Partial<Usuario> = {}): Usuario {
  return { id: "u", email: "u@prueba.test", nombre: "Uno", apellido: "Prueba", rol, condominioId: "c", departamentoId: null, ...extra };
}

function sesion(valor: Partial<AuthContextValue>): AuthContextValue {
  return { usuario: null, cargando: false, login: vi.fn(), logout: vi.fn(), actualizarUsuario: vi.fn(), ...valor };
}

function renderRuta(auth: AuthContextValue, roles?: Rol[]) {
  return renderizarConProveedores(
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route path="/login" element={<p>Pantalla de login</p>} />
        <Route path="/" element={<p>Inicio</p>} />
        <Route
          path="/privado"
          element={
            <ProtectedRoute roles={roles}>
              <p>Contenido privado</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthContext.Provider>,
    { rutaInicial: "/privado" }
  );
}

describe("ProtectedRoute", () => {
  it("mientras se comprueba la sesión muestra un estado de carga accesible (no una pantalla en blanco)", () => {
    renderRuta(sesion({ cargando: true }));
    // (el otro "status" de la pagina es la zona de avisos, vacia)
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
  });

  it("sin sesión redirige al login", () => {
    renderRuta(sesion({ usuario: null }));
    expect(screen.getByText("Pantalla de login")).toBeInTheDocument();
  });

  it("con una contraseña temporal obliga a cambiarla antes de mostrar nada más", () => {
    renderRuta(sesion({ usuario: usuario("RESIDENTE", { debeCambiarPassword: true }) }));
    expect(screen.getByRole("heading", { name: "Elige tu contraseña" })).toBeInTheDocument();
    expect(screen.queryByText("Contenido privado")).not.toBeInTheDocument();
  });

  it("con un rol no permitido vuelve al inicio; con el rol correcto muestra el contenido", () => {
    const { unmount } = renderRuta(sesion({ usuario: usuario("RESIDENTE") }), ["ADMIN"]);
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    unmount();
    renderRuta(sesion({ usuario: usuario("ADMIN") }), ["ADMIN"]);
    expect(screen.getByText("Contenido privado")).toBeInTheDocument();
  });
});
