import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, CABECERA_CSRF, COOKIE_CSRF, haySesionLocal, limpiarTokenAntiguo, olvidarSesionLocal, tokenCsrf } from "./client";

function ponerCookie(nombre: string, valor: string) {
  document.cookie = `${nombre}=${valor}; path=/`;
}

function borrarCookie(nombre: string) {
  document.cookie = `${nombre}=; Max-Age=0; path=/`;
}

beforeEach(() => {
  borrarCookie(COOKIE_CSRF);
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("transición desde el token antiguo en localStorage", () => {
  it("limpiarTokenAntiguo borra el JWT que guardaban versiones anteriores (localStorage y sessionStorage)", () => {
    localStorage.setItem("habitasmart_token", "jwt-viejo");
    sessionStorage.setItem("habitasmart_token", "jwt-viejo");
    limpiarTokenAntiguo();
    expect(localStorage.getItem("habitasmart_token")).toBeNull();
    expect(sessionStorage.getItem("habitasmart_token")).toBeNull();
  });

  it("el cliente HTTP no guarda ningún token en el almacenamiento del navegador", () => {
    ponerCookie(COOKIE_CSRF, "abc");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe("marca local de sesión (cookie CSRF legible)", () => {
  it("haySesionLocal refleja la presencia de la cookie y olvidarSesionLocal la borra", () => {
    expect(haySesionLocal()).toBe(false);
    ponerCookie(COOKIE_CSRF, "abc123");
    expect(haySesionLocal()).toBe(true);
    expect(tokenCsrf()).toBe("abc123");
    olvidarSesionLocal();
    expect(haySesionLocal()).toBe(false);
  });
});

describe("cabecera anti-CSRF", () => {
  async function cabeceraEnviada(metodo: "get" | "post" | "patch" | "delete") {
    const adaptador = vi.fn(async (config) => ({ data: {}, status: 200, statusText: "OK", headers: {}, config }));
    api.defaults.adapter = adaptador;
    await api.request({ method: metodo, url: "/prueba" });
    const config = adaptador.mock.calls[0][0];
    return { cabecera: config.headers[CABECERA_CSRF], withCredentials: config.withCredentials };
  }

  it("en POST/PATCH/DELETE repite el token de la cookie en X-CSRF-Token y envía credenciales", async () => {
    ponerCookie(COOKIE_CSRF, "token-csrf");
    for (const metodo of ["post", "patch", "delete"] as const) {
      const { cabecera, withCredentials } = await cabeceraEnviada(metodo);
      expect(cabecera).toBe("token-csrf");
      expect(withCredentials).toBe(true);
    }
  });

  it("en GET no agrega la cabecera, y sin cookie tampoco", async () => {
    ponerCookie(COOKIE_CSRF, "token-csrf");
    expect((await cabeceraEnviada("get")).cabecera).toBeUndefined();
    borrarCookie(COOKIE_CSRF);
    expect((await cabeceraEnviada("post")).cabecera).toBeUndefined();
  });
});
