import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { CONFIG_DEMO, CONFIG_REAL, renderizarConProveedores } from "../test/proveedores";
import Login from "./Login";
import type { Usuario } from "../types";

vi.mock("../api/endpoints", () => ({
  authApi: { login: vi.fn(), me: vi.fn(), logout: vi.fn() },
}));

import { authApi } from "../api/endpoints";

const login = vi.mocked(authApi.login);

const USUARIO: Usuario = {
  id: "u-1",
  email: "residente@prueba.test",
  nombre: "Rosa",
  apellido: "Prueba",
  rol: "RESIDENTE",
  condominioId: "c-1",
  departamentoId: null,
};

function errorHttp(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("fallo", "ERR", config, {}, { status, data, statusText: "", headers: {}, config });
}

function renderLogin(config = CONFIG_REAL) {
  return renderizarConProveedores(
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>Inicio de la app</p>} />
      </Routes>
    </AuthProvider>,
    { config, rutaInicial: "/login" }
  );
}

async function completar(user: ReturnType<typeof userEvent.setup>, email: string, clave: string) {
  await user.type(screen.getByLabelText(/correo/i), email);
  await user.type(screen.getByLabelText(/^contraseña/i), clave);
  await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
}

beforeEach(() => {
  localStorage.clear();
});

describe("Login", () => {
  it("con credenciales correctas entra a la app y no guarda ningún token en el navegador", async () => {
    login.mockResolvedValue({ usuario: USUARIO });
    const user = userEvent.setup();
    renderLogin();

    await completar(user, "residente@prueba.test", "Clave-1234");

    expect(await screen.findByText("Inicio de la app")).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith("residente@prueba.test", "Clave-1234");
    expect(localStorage.getItem("habitasmart_token")).toBeNull();
    expect(Object.keys(localStorage)).not.toContain("habitasmart_token");
  });

  it("con credenciales incorrectas muestra el mensaje genérico del servidor como alerta", async () => {
    login.mockRejectedValue(errorHttp(401, { error: "Correo o contraseña incorrectos." }));
    const user = userEvent.setup();
    renderLogin();

    await completar(user, "residente@prueba.test", "mala");

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(screen.queryByText("Inicio de la app")).not.toBeInTheDocument();
  });

  it("si el servidor no responde, dice que es un problema de conexión (no de contraseña)", async () => {
    login.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    const user = userEvent.setup();
    renderLogin();

    await completar(user, "residente@prueba.test", "Clave-1234");

    expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudo conectar con el servidor/);
  });

  it("mientras espera, el botón queda deshabilitado: un doble clic envía una sola vez", async () => {
    let responder: (v: { usuario: Usuario }) => void = () => {};
    login.mockReturnValue(new Promise((r) => (responder = r)));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/correo/i), "residente@prueba.test");
    await user.type(screen.getByLabelText(/^contraseña/i), "Clave-1234");
    const boton = screen.getByRole("button", { name: "Iniciar sesión" });
    await user.dblClick(boton);

    expect(login).toHaveBeenCalledTimes(1);
    expect(boton).toBeDisabled();
    responder({ usuario: USUARIO });
    expect(await screen.findByText("Inicio de la app")).toBeInTheDocument();
  });

  it("las cuentas de demostración solo aparecen si el servidor lo indica, junto al aviso de SOS demo", async () => {
    const { unmount } = renderLogin(CONFIG_REAL);
    expect(screen.queryByText(/cuenta de demostración/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("login-modo-demo")).not.toBeInTheDocument();
    unmount();

    renderLogin(CONFIG_DEMO);
    expect(screen.getByText(/cuenta de demostración/i)).toBeInTheDocument();
    expect(screen.getByTestId("login-modo-demo")).toHaveTextContent("no llama a números reales");
  });

  it("el botón para mostrar la contraseña es accesible y alterna el tipo del campo", async () => {
    const user = userEvent.setup();
    renderLogin();
    const campo = screen.getByLabelText(/^contraseña/i);
    expect(campo).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(campo).toHaveAttribute("type", "text");
    await waitFor(() => expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute("aria-pressed", "true"));
  });
});
