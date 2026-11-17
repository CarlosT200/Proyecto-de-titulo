import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Rol } from "@prisma/client";
import { cerrarBase, prepararBase, type DatosPrueba } from "./base";
import { anonimo, entrar, type ClienteHttp } from "./cliente";

// --- Matriz automatizada de permisos ------------------------------------------------------------
// Para cada ruta de la API se declara que roles pueden usarla. La prueba comprueba, para los tres
// roles, que los permitidos NO reciben 401/403 (pueden recibir 404/409/422 por los datos minimos
// que se envian: lo que importa es que la autorizacion los dejo pasar) y que los demas reciben 403.
// Sin sesion, todas responden 401. Asi, si alguien cambia un requireRole por error, esta prueba
// lo detecta.

type Metodo = "get" | "post" | "patch" | "put" | "delete";
const TODOS: Rol[] = [Rol.ADMIN, Rol.RESIDENTE, Rol.CONSERJE];
const ID = randomUUID();

interface Ruta {
  metodo: Metodo;
  ruta: string;
  roles: Rol[];
}

const RUTAS: Ruta[] = [
  // auth (cualquier sesion)
  { metodo: "get", ruta: "/api/auth/me", roles: TODOS },
  { metodo: "get", ruta: "/api/auth/sesiones", roles: TODOS },
  { metodo: "patch", ruta: "/api/auth/me", roles: TODOS },
  // usuarios
  { metodo: "get", ruta: "/api/usuarios", roles: [Rol.ADMIN, Rol.CONSERJE] },
  { metodo: "get", ruta: `/api/usuarios/${ID}`, roles: [Rol.ADMIN, Rol.CONSERJE] },
  { metodo: "post", ruta: "/api/usuarios", roles: [Rol.ADMIN] },
  { metodo: "patch", ruta: `/api/usuarios/${ID}`, roles: [Rol.ADMIN] },
  { metodo: "post", ruta: `/api/usuarios/${ID}/restablecer-password`, roles: [Rol.ADMIN] },
  // condominio
  { metodo: "get", ruta: "/api/condominio", roles: TODOS },
  { metodo: "patch", ruta: "/api/condominio", roles: [Rol.ADMIN] },
  { metodo: "get", ruta: "/api/condominio/torres", roles: [Rol.ADMIN] },
  { metodo: "post", ruta: "/api/condominio/torres", roles: [Rol.ADMIN] },
  { metodo: "get", ruta: "/api/condominio/departamentos", roles: [Rol.ADMIN] },
  { metodo: "post", ruta: "/api/condominio/departamentos", roles: [Rol.ADMIN] },
  { metodo: "get", ruta: "/api/condominio/espacios-comunes", roles: TODOS },
  { metodo: "post", ruta: "/api/condominio/espacios-comunes", roles: [Rol.ADMIN] },
  { metodo: "patch", ruta: `/api/condominio/espacios-comunes/${ID}`, roles: [Rol.ADMIN] },
  // reservas
  { metodo: "get", ruta: "/api/reservas/disponibilidad", roles: TODOS },
  { metodo: "get", ruta: "/api/reservas/ocupacion", roles: TODOS },
  { metodo: "post", ruta: "/api/reservas", roles: [Rol.RESIDENTE] },
  { metodo: "get", ruta: "/api/reservas/mias", roles: [Rol.RESIDENTE] },
  { metodo: "get", ruta: "/api/reservas", roles: [Rol.ADMIN] },
  { metodo: "patch", ruta: `/api/reservas/${ID}/cancelar`, roles: TODOS },
  // multas
  { metodo: "post", ruta: "/api/multas", roles: [Rol.ADMIN] },
  { metodo: "get", ruta: "/api/multas/mias", roles: [Rol.RESIDENTE] },
  { metodo: "patch", ruta: `/api/multas/${ID}/apelar`, roles: [Rol.RESIDENTE] },
  { metodo: "patch", ruta: `/api/multas/${ID}/resolver-apelacion`, roles: [Rol.ADMIN] },
  { metodo: "get", ruta: "/api/multas", roles: [Rol.ADMIN] },
  { metodo: "patch", ruta: `/api/multas/${ID}`, roles: [Rol.ADMIN] },
  { metodo: "delete", ruta: `/api/multas/${ID}`, roles: [Rol.ADMIN] },
  // incidencias
  { metodo: "post", ruta: "/api/incidencias", roles: [Rol.RESIDENTE] },
  { metodo: "get", ruta: "/api/incidencias/mias", roles: [Rol.RESIDENTE] },
  { metodo: "get", ruta: "/api/incidencias", roles: [Rol.ADMIN] },
  { metodo: "get", ruta: `/api/incidencias/${ID}`, roles: [Rol.ADMIN, Rol.RESIDENTE] },
  { metodo: "patch", ruta: `/api/incidencias/${ID}`, roles: [Rol.ADMIN] },
  // encomiendas
  { metodo: "post", ruta: "/api/encomiendas", roles: [Rol.CONSERJE] },
  { metodo: "get", ruta: "/api/encomiendas/mias", roles: [Rol.RESIDENTE] },
  { metodo: "get", ruta: "/api/encomiendas", roles: [Rol.ADMIN, Rol.CONSERJE] },
  { metodo: "get", ruta: `/api/encomiendas/${ID}`, roles: TODOS },
  { metodo: "patch", ruta: `/api/encomiendas/${ID}/retirar`, roles: [Rol.CONSERJE] },
  { metodo: "patch", ruta: `/api/encomiendas/${ID}/devolver`, roles: [Rol.CONSERJE] },
  // comunicados
  { metodo: "post", ruta: "/api/comunicados", roles: [Rol.ADMIN] },
  { metodo: "get", ruta: "/api/comunicados", roles: TODOS },
  { metodo: "delete", ruta: `/api/comunicados/${ID}`, roles: [Rol.ADMIN] },
  // qr / visitas
  { metodo: "post", ruta: "/api/qr/residente", roles: [Rol.RESIDENTE] },
  { metodo: "post", ruta: "/api/qr/visitas", roles: [Rol.RESIDENTE] },
  { metodo: "get", ruta: "/api/qr/visitas/mias", roles: [Rol.RESIDENTE] },
  { metodo: "post", ruta: `/api/qr/visitas/${ID}/qr`, roles: [Rol.RESIDENTE] },
  { metodo: "get", ruta: `/api/qr/visitas/${ID}/qr`, roles: [Rol.RESIDENTE] },
  { metodo: "post", ruta: "/api/qr/visitas/rapida", roles: [Rol.RESIDENTE] },
  { metodo: "patch", ruta: `/api/qr/visitas/${ID}/revocar`, roles: [Rol.RESIDENTE] },
  { metodo: "post", ruta: "/api/qr/validar", roles: [Rol.CONSERJE] },
  { metodo: "get", ruta: "/api/qr/accesos", roles: [Rol.ADMIN, Rol.CONSERJE] },
  // documentos
  { metodo: "post", ruta: "/api/documentos", roles: [Rol.ADMIN] },
  { metodo: "get", ruta: "/api/documentos", roles: TODOS },
  { metodo: "get", ruta: `/api/documentos/${ID}/archivo`, roles: TODOS },
  { metodo: "delete", ruta: `/api/documentos/${ID}`, roles: [Rol.ADMIN] },
  // dashboard
  { metodo: "get", ruta: "/api/dashboard", roles: [Rol.ADMIN] },
  { metodo: "get", ruta: "/api/dashboard/conserjeria", roles: [Rol.ADMIN, Rol.CONSERJE] },
  // notificaciones (propias)
  { metodo: "get", ruta: "/api/notificaciones", roles: TODOS },
  { metodo: "patch", ruta: "/api/notificaciones/leer-todas", roles: TODOS },
  { metodo: "delete", ruta: "/api/notificaciones", roles: TODOS },
  // sos
  { metodo: "post", ruta: "/api/sos", roles: [Rol.RESIDENTE] },
  { metodo: "get", ruta: "/api/sos", roles: [Rol.ADMIN, Rol.CONSERJE] },
  { metodo: "patch", ruta: `/api/sos/${ID}/atender`, roles: [Rol.ADMIN, Rol.CONSERJE] },
  // push
  { metodo: "post", ruta: "/api/push/suscribir", roles: TODOS },
  { metodo: "delete", ruta: "/api/push/suscribir", roles: TODOS },
  // auditoria
  { metodo: "get", ruta: "/api/auditoria", roles: [Rol.ADMIN] },
  // gastos comunes
  { metodo: "get", ruta: "/api/gastos-comunes/mi-cuenta", roles: [Rol.RESIDENTE] },
  { metodo: "get", ruta: `/api/gastos-comunes/cobros/${ID}`, roles: [Rol.ADMIN, Rol.RESIDENTE] },
  { metodo: "post", ruta: `/api/gastos-comunes/cobros/${ID}/comprobantes`, roles: [Rol.RESIDENTE] },
  { metodo: "get", ruta: `/api/gastos-comunes/comprobantes/${ID}/archivo`, roles: [Rol.ADMIN, Rol.RESIDENTE] },
  { metodo: "get", ruta: "/api/gastos-comunes/periodos", roles: [Rol.ADMIN] },
  { metodo: "post", ruta: "/api/gastos-comunes/periodos", roles: [Rol.ADMIN] },
  { metodo: "get", ruta: `/api/gastos-comunes/periodos/${ID}`, roles: [Rol.ADMIN] },
  { metodo: "delete", ruta: `/api/gastos-comunes/periodos/${ID}`, roles: [Rol.ADMIN] },
  { metodo: "get", ruta: "/api/gastos-comunes/morosidad", roles: [Rol.ADMIN] },
  { metodo: "post", ruta: `/api/gastos-comunes/cobros/${ID}/pagos`, roles: [Rol.ADMIN] },
  { metodo: "patch", ruta: `/api/gastos-comunes/pagos/${ID}/anular`, roles: [Rol.ADMIN] },
  { metodo: "get", ruta: "/api/gastos-comunes/comprobantes", roles: [Rol.ADMIN] },
  { metodo: "patch", ruta: `/api/gastos-comunes/comprobantes/${ID}/aprobar`, roles: [Rol.ADMIN] },
  { metodo: "patch", ruta: `/api/gastos-comunes/comprobantes/${ID}/rechazar`, roles: [Rol.ADMIN] },
  { metodo: "get", ruta: "/api/gastos-comunes/alicuotas", roles: [Rol.ADMIN] },
  { metodo: "put", ruta: "/api/gastos-comunes/alicuotas", roles: [Rol.ADMIN] },
];

let datos: DatosPrueba;
const clientes: Partial<Record<Rol, ClienteHttp>> = {};

beforeAll(async () => {
  datos = await prepararBase();
  clientes.ADMIN = await entrar(datos.a.admin);
  clientes.RESIDENTE = await entrar(datos.a.residente);
  clientes.CONSERJE = await entrar(datos.a.conserje);
});

afterAll(cerrarBase);

function pedir(cliente: ClienteHttp, r: Ruta) {
  const req = cliente[r.metodo](r.ruta);
  // Un cuerpo minimo: lo que importa es si la autorizacion deja pasar, no si los datos son validos.
  return r.metodo === "get" ? req : req.send({});
}

describe("matriz de permisos por rol", () => {
  it.each(RUTAS.map((r) => [`${r.metodo.toUpperCase()} ${r.ruta}`, r] as const))("%s", async (_nombre, r) => {
    for (const rol of TODOS) {
      const res = await pedir(clientes[rol]!, r);
      if (r.roles.includes(rol)) {
        expect(res.status, `${rol} debería poder usar ${r.metodo.toUpperCase()} ${r.ruta} (respondió ${res.status})`).not.toBe(403);
        expect(res.status, `${rol} con sesión no debería recibir 401 en ${r.ruta}`).not.toBe(401);
      } else {
        expect(res.status, `${rol} NO debería poder usar ${r.metodo.toUpperCase()} ${r.ruta} (respondió ${res.status})`).toBe(403);
      }
    }
  });

  it("sin sesión, todas las rutas protegidas responden 401", async () => {
    const sin = anonimo();
    for (const r of RUTAS) {
      const res = await pedir(sin, r);
      expect(res.status, `${r.metodo.toUpperCase()} ${r.ruta} sin sesión`).toBe(401);
    }
  });

  it("la lista de rutas protegidas cubre todas las rutas registradas en la aplicación", async () => {
    // Si alguien agrega una ruta nueva y olvida declararla aqui, esta prueba lo recuerda.
    const { app } = await import("./cliente");
    const registradas = new Set<string>();
    const pila: { handle: unknown; prefijo: string }[] = [{ handle: app._router, prefijo: "" }];
    while (pila.length) {
      const { handle, prefijo } = pila.pop()!;
      const router = handle as { stack?: { route?: { path: string; methods: Record<string, boolean> }; handle?: unknown; regexp?: RegExp }[] };
      for (const capa of router.stack ?? []) {
        if (capa.route) {
          const ruta = `${prefijo}${capa.route.path}`.replace(/\/+$/, "") || "/";
          for (const m of Object.keys(capa.route.methods)) registradas.add(`${m.toUpperCase()} ${ruta}`);
        } else if (capa.handle && (capa.handle as { stack?: unknown }).stack) {
          const base = capa.regexp?.source.replace("^\\", "").replace("\\/?(?=\\/|$)", "").replace(/\\\//g, "/") ?? "";
          pila.push({ handle: capa.handle, prefijo: prefijo + base });
        }
      }
    }
    const publicas = new Set([
      "GET /health",
      "GET /ready",
      "GET /api/config",
      "POST /api/auth/login",
      "GET /api/push/vapid-public-key",
      "POST /api/tareas/recordatorios",
      "GET *",
    ]);
    const declaradas = new Set(RUTAS.map((r) => `${r.metodo.toUpperCase()} ${r.ruta.replace(ID, ":id")}`));
    const faltantes = [...registradas].filter(
      (ruta) =>
        !publicas.has(ruta) &&
        !declaradas.has(ruta) &&
        // rutas de sesion que ya cubre auth.int.test.ts
        !["POST /api/auth/logout", "POST /api/auth/logout-todas", "DELETE /api/auth/sesiones/:id", "PATCH /api/auth/me/foto", "PATCH /api/auth/me/password", "PATCH /api/notificaciones/:id/leer", "DELETE /api/notificaciones/:id"].includes(ruta)
    );
    expect(faltantes).toEqual([]);
  });
});
