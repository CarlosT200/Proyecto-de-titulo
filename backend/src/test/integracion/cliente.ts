import request from "supertest";
import { app } from "../../app";
import { CABECERA_CSRF, COOKIE_CSRF, COOKIE_SESION } from "../../lib/sesiones";
import { PASSWORD_PRUEBA, type UsuarioPrueba } from "./base";

// Origen permitido en las pruebas (APP_URL de vitest.integracion.config.ts).
export const ORIGEN = "http://localhost:4000";

type Metodo = "get" | "post" | "patch" | "put" | "delete";

// Cliente HTTP con sesion: el agente de supertest conserva las cookies; aqui se agregan ademas el
// Origin permitido y la cabecera anti-CSRF que el navegador real manda desde api/client.ts.
export class ClienteHttp {
  constructor(
    readonly agente: request.Agent,
    public csrf: string | null
  ) {}

  private pedido(metodo: Metodo, url: string) {
    let r = this.agente[metodo](url).set("Origin", ORIGEN);
    if (this.csrf) r = r.set(CABECERA_CSRF, this.csrf);
    return r;
  }

  get(url: string) {
    return this.pedido("get", url);
  }
  post(url: string) {
    return this.pedido("post", url);
  }
  patch(url: string) {
    return this.pedido("patch", url);
  }
  put(url: string) {
    return this.pedido("put", url);
  }
  delete(url: string) {
    return this.pedido("delete", url);
  }

  // Igual que post, pero SIN la cabecera CSRF (para comprobar que se rechaza).
  postSinCsrf(url: string) {
    return this.agente.post(url).set("Origin", ORIGEN);
  }
}

export function valorDeCookie(setCookie: string[] | string | undefined, nombre: string): string | null {
  const lista = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const c of lista) {
    const [par] = c.split(";");
    const [clave, ...resto] = par.split("=");
    if (clave === nombre) return resto.join("=");
  }
  return null;
}

export function cookieCruda(setCookie: string[] | string | undefined, nombre: string): string | null {
  const lista = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return lista.find((c) => c.startsWith(`${nombre}=`)) ?? null;
}

// Cliente anonimo (sin sesion).
export function anonimo(): ClienteHttp {
  return new ClienteHttp(request.agent(app), null);
}

// Inicia sesion y devuelve un cliente con las cookies y el token CSRF listos.
export async function entrar(usuario: UsuarioPrueba | string, password = PASSWORD_PRUEBA): Promise<ClienteHttp> {
  const email = typeof usuario === "string" ? usuario : usuario.email;
  const agente = request.agent(app);
  const res = await agente.post("/api/auth/login").set("Origin", ORIGEN).send({ email, password });
  if (res.status !== 200) {
    throw new Error(`No se pudo iniciar sesión como ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const csrf = valorDeCookie(res.headers["set-cookie"], COOKIE_CSRF);
  const sesion = valorDeCookie(res.headers["set-cookie"], COOKIE_SESION);
  if (!csrf || !sesion) throw new Error("El login no dejó las cookies de sesión.");
  return new ClienteHttp(agente, csrf);
}

export { app };
