import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TipoEmergenciaSos } from "@prisma/client";
import { cabecerasDeCache } from "../../app";
import { cerrarBase, prepararBase, prisma, type DatosPrueba } from "./base";
import { anonimo, entrar } from "./cliente";

let datos: DatosPrueba;

beforeAll(async () => {
  datos = await prepararBase();
});

afterAll(cerrarBase);

describe("health y readiness", () => {
  it("/health responde sin tocar la base y sin datos internos", async () => {
    const res = await anonimo().get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("/ready comprueba la base y responde solo el estado", async () => {
    const res = await anonimo().get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("/ready responde 503 si la base no contesta, sin revelar el motivo", async () => {
    const espia = vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("connect ECONNREFUSED postgres://u:clave@h"));
    const salida = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const res = await anonimo().get("/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "no-disponible" });
    expect(salida.mock.calls.map((c) => String(c[0])).join("")).not.toContain("clave@");
    espia.mockRestore();
    salida.mockRestore();
  });
});

describe("identificador de solicitud", () => {
  it("cada respuesta lleva X-Request-Id; se respeta uno válido del proxy y se reemplaza uno inválido", async () => {
    const propio = await anonimo().get("/health");
    expect(propio.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);

    const delProxy = await anonimo().agente.get("/health").set("X-Request-Id", "cf-abc123456");
    expect(delProxy.headers["x-request-id"]).toBe("cf-abc123456");

    const malicioso = await anonimo().agente.get("/health").set("X-Request-Id", "x <script>alert(1)</script>");
    expect(malicioso.headers["x-request-id"]).not.toContain("script");
  });

  it("un 500 devuelve un código de referencia y nunca la pila", async () => {
    const cliente = await entrar(datos.a.admin);
    const espia = vi.spyOn(prisma.usuario, "findMany").mockRejectedValueOnce(new TypeError("fallo interno inesperado en x.ts:12"));
    const salida = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const res = await cliente.get("/api/usuarios");
    expect(res.status).toBe(500);
    expect(res.body.referencia).toBe(res.headers["x-request-id"]);
    expect(JSON.stringify(res.body)).not.toMatch(/x\.ts|TypeError|stack/);
    espia.mockRestore();
    salida.mockRestore();
  });

  it("si la base deja de responder a mitad de una operación, responde 503 (reintentable)", async () => {
    const { Prisma } = await import("@prisma/client");
    const cliente = await entrar(datos.a.admin);
    const espia = vi
      .spyOn(prisma.usuario, "findMany")
      .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Can't reach database server", { code: "P1001", clientVersion: "test" }));
    const salida = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const res = await cliente.get("/api/usuarios");
    expect(res.status).toBe(503);
    espia.mockRestore();
    salida.mockRestore();
  });
});

describe("caché de recursos estáticos", () => {
  it("los assets con hash son inmutables; index.html y el service worker se revalidan", () => {
    expect(cabecerasDeCache("/app/frontend/dist/assets/index-abc123.js")).toBe("public, max-age=31536000, immutable");
    expect(cabecerasDeCache("C:\\app\\frontend\\dist\\assets\\index-abc.css")).toBe("public, max-age=31536000, immutable");
    expect(cabecerasDeCache("/app/frontend/dist/index.html")).toBe("no-cache");
    expect(cabecerasDeCache("/app/frontend/dist/sw.js")).toBe("no-cache");
    expect(cabecerasDeCache("/app/frontend/dist/icon-192.png")).toBe("public, max-age=3600");
  });
});

describe("límite del fallback de la SPA en la app real", () => {
  it("el fallback lleva las cabeceras RateLimit; /health, /ready, /api/config y /api no", async () => {
    const spa = await anonimo().get("/residente/qr");
    expect(spa.headers["ratelimit"]).toBeDefined();
    expect(spa.headers["x-ratelimit-limit"]).toBeUndefined();
    for (const ruta of ["/health", "/ready", "/api/config", "/api/no-existe"]) {
      const res = await anonimo().get(ruta);
      expect(res.headers["ratelimit"], ruta).toBeUndefined();
    }
  });
});

describe("SOS en el entorno de pruebas (modo demostración)", () => {
  it("/api/config indica sosModoDemo:true en este entorno", async () => {
    const res = await anonimo().get("/api/config");
    expect(res.body).toEqual({ cuentasDemo: false, sosModoDemo: true });
  });

  it("crea la alerta marcada como demo y un doble envío devuelve la MISMA alerta sin nuevos avisos", async () => {
    const residente = await entrar(datos.a.residente);
    const primera = await residente.post("/api/sos").send({ tipo: "BOMBEROS" });
    expect(primera.status).toBe(201);
    expect(primera.body).toMatchObject({ tipo: "BOMBEROS", modoDemo: true, repetida: false });

    const segunda = await residente.post("/api/sos").send({ tipo: "BOMBEROS" });
    expect(segunda.status).toBe(200);
    expect(segunda.body).toMatchObject({ id: primera.body.id, repetida: true });

    expect(await prisma.alertaSos.count({ where: { usuarioId: datos.a.residente.id, tipo: TipoEmergenciaSos.BOMBEROS } })).toBe(1);
    const avisos = await prisma.notificacion.findMany({ where: { entidadId: primera.body.id } });
    // un aviso por persona del personal (admin y conserje), no dos
    expect(avisos).toHaveLength(2);
    for (const aviso of avisos) expect(aviso.titulo).toMatch(/^\[DEMO\]/);
  });

  it("dos envíos simultáneos del mismo residente no dejan más de dos alertas (y en general una)", async () => {
    const residente = await entrar(datos.a.residente2);
    const [a, b] = await Promise.all([
      residente.post("/api/sos").send({ tipo: "AMBULANCIA" }),
      residente.post("/api/sos").send({ tipo: "AMBULANCIA" }),
    ]);
    expect([a.status, b.status].every((s) => s === 200 || s === 201)).toBe(true);
    const total = await prisma.alertaSos.count({ where: { usuarioId: datos.a.residente2.id, tipo: TipoEmergenciaSos.AMBULANCIA } });
    // La ventana de idempotencia no es una restriccion unica: dos pedidos en el mismo milisegundo
    // pueden crear dos (limitacion documentada). Lo que se garantiza es que nunca se multiplican.
    expect(total).toBeLessThanOrEqual(2);
  });
});
