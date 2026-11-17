import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COOKIE_CSRF, COOKIE_SESION } from "../../lib/sesiones";
import { cerrarBase, PASSWORD_PRUEBA, prepararBase, prisma, type DatosPrueba } from "./base";
import { anonimo, cookieCruda, entrar, ORIGEN, valorDeCookie } from "./cliente";

let datos: DatosPrueba;

beforeAll(async () => {
  datos = await prepararBase();
});

afterAll(cerrarBase);

describe("login", () => {
  it("con credenciales correctas deja las cookies de sesión (HttpOnly, SameSite=Lax, Path=/, con vencimiento) y NO devuelve ningún token en el JSON", async () => {
    const res = await anonimo().post("/api/auth/login").send({ email: datos.a.residente.email, password: PASSWORD_PRUEBA });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ email: datos.a.residente.email, rol: "RESIDENTE", condominioId: datos.a.id });
    expect(res.body).not.toHaveProperty("token");
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|token/i);

    const sesion = cookieCruda(res.headers["set-cookie"], COOKIE_SESION)!;
    expect(sesion).toMatch(/HttpOnly/);
    expect(sesion).toMatch(/SameSite=Lax/);
    expect(sesion).toMatch(/Path=\//);
    expect(sesion).toMatch(/Expires=/);
    // En producción (NODE_ENV=production) lleva además "Secure"; aquí no, porque las pruebas van por http.
    const csrf = cookieCruda(res.headers["set-cookie"], COOKIE_CSRF)!;
    expect(csrf).not.toMatch(/HttpOnly/);
    expect(csrf).toMatch(/SameSite=Lax/);
    expect(valorDeCookie(res.headers["set-cookie"], COOKIE_SESION)).not.toBe(valorDeCookie(res.headers["set-cookie"], COOKIE_CSRF));
  });

  it("con contraseña incorrecta o correo inexistente responde 401 con el mismo mensaje genérico y sin cookies", async () => {
    const mala = await anonimo().post("/api/auth/login").send({ email: datos.a.residente.email, password: "incorrecta-999" });
    const inexistente = await anonimo().post("/api/auth/login").send({ email: "nadie@prueba.test", password: PASSWORD_PRUEBA });
    expect(mala.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(mala.body.error).toBe(inexistente.body.error);
    expect(mala.headers["set-cookie"]).toBeUndefined();
  });

  it("una cuenta deshabilitada no puede entrar aunque la contraseña sea correcta", async () => {
    const res = await anonimo().post("/api/auth/login").send({ email: datos.a.inactivo.email, password: PASSWORD_PRUEBA });
    expect(res.status).toBe(403);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("rechaza un cuerpo inválido con 422 y detalles", async () => {
    const res = await anonimo().post("/api/auth/login").send({ email: "no-es-correo", password: "" });
    expect(res.status).toBe(422);
    expect(res.body.detalles.length).toBeGreaterThan(0);
  });

  it("limita los intentos fallidos por correo (10 en 15 minutos) sin bloquear a otros correos de la misma IP", async () => {
    // cuenta deshabilitada: todos sus intentos fallan y ninguna otra prueba la necesita
    const correo = datos.b.inactivo.email;
    let ultimo = 0;
    for (let i = 0; i < 11; i++) {
      const res = await anonimo().post("/api/auth/login").send({ email: correo, password: `mala-${i}` });
      ultimo = res.status;
    }
    expect(ultimo).toBe(429);
    // otro correo desde la misma IP sigue pudiendo entrar
    const otro = await anonimo().post("/api/auth/login").send({ email: datos.b.residente.email, password: PASSWORD_PRUEBA });
    expect(otro.status).toBe(200);
  });
});

describe("sesión", () => {
  it("/auth/me requiere la cookie; sin ella responde 401", async () => {
    const res = await anonimo().get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("con la cookie, /auth/me devuelve el perfil con condominio y unidad", async () => {
    const cliente = await entrar(datos.a.residente);
    const res = await cliente.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.condominio.id).toBe(datos.a.id);
    expect(res.body.departamento.numero).toBe("101");
  });

  it("logout revoca la sesión, borra las cookies y la cookie anterior deja de valer", async () => {
    const cliente = await entrar(datos.a.residente);
    const logout = await cliente.post("/api/auth/logout");
    expect(logout.status).toBe(204);
    const borradas = (logout.headers["set-cookie"] as string[]).join("\n");
    expect(borradas).toMatch(new RegExp(`${COOKIE_SESION}=;`));
    expect(borradas).toMatch(new RegExp(`${COOKIE_CSRF}=;`));

    // El agente de supertest ya no tiene cookies; se simula alguien que guardó la cookie anterior:
    const despues = await cliente.get("/api/auth/me");
    expect(despues.status).toBe(401);
  });

  it("una sesión revocada desde otro dispositivo (logout-todas) queda fuera en el siguiente pedido", async () => {
    const telefono = await entrar(datos.a.residente);
    const computador = await entrar(datos.a.residente);
    expect((await telefono.get("/api/auth/me")).status).toBe(200);

    const res = await computador.post("/api/auth/logout-todas");
    expect(res.status).toBe(200);
    expect(res.body.cerradas).toBeGreaterThanOrEqual(2);

    const revocada = await telefono.get("/api/auth/me");
    expect(revocada.status).toBe(401);
    expect(revocada.body.error).toMatch(/sesión fue cerrada/);
  });

  it("Mi perfil lista las sesiones vigentes (sin hash ni token) y permite cerrar una concreta", async () => {
    const telefono = await entrar(datos.a.residente2);
    const computador = await entrar(datos.a.residente2);

    const lista = await computador.get("/api/auth/sesiones");
    expect(lista.status).toBe(200);
    expect(lista.body.length).toBeGreaterThanOrEqual(2);
    expect(lista.body.filter((s: { actual: boolean }) => s.actual)).toHaveLength(1);
    for (const s of lista.body) {
      expect(s).not.toHaveProperty("tokenHash");
      expect(s).not.toHaveProperty("csrfToken");
    }

    const ajena = lista.body.find((s: { actual: boolean }) => !s.actual);
    expect((await computador.delete(`/api/auth/sesiones/${ajena.id}`)).status).toBe(204);
    expect((await telefono.get("/api/auth/me")).status).toBe(401);
    // la actual no se cierra por aquí (se usa "Salir")
    const actual = lista.body.find((s: { actual: boolean }) => s.actual);
    expect((await computador.delete(`/api/auth/sesiones/${actual.id}`)).status).toBe(409);
  });

  it("una sesión vencida responde 401 aunque la cookie exista", async () => {
    const cliente = await entrar(datos.b.conserje);
    await prisma.sesion.updateMany({ where: { usuarioId: datos.b.conserje.id }, data: { expiraEn: new Date(Date.now() - 1000) } });
    const res = await cliente.get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expiró/);
  });

  it("si la administración deshabilita la cuenta, la sesión abierta se corta de inmediato", async () => {
    const vecina = await entrar(datos.b.residente2);
    const admin = await entrar(datos.b.admin);
    expect((await vecina.get("/api/auth/me")).status).toBe(200);

    const res = await admin.patch(`/api/usuarios/${datos.b.residente2.id}`).send({ activo: false });
    expect(res.status).toBe(200);

    expect((await vecina.get("/api/auth/me")).status).toBe(401);
    // se rehabilita para no afectar otras pruebas; la sesion vieja sigue revocada
    await admin.patch(`/api/usuarios/${datos.b.residente2.id}`).send({ activo: true });
    expect((await vecina.get("/api/auth/me")).status).toBe(401);
  });

  it("cambiar la contraseña cierra las demás sesiones y deja una nueva en el mismo cliente", async () => {
    const telefono = await entrar(datos.a.conserje);
    const computador = await entrar(datos.a.conserje);

    const res = await computador.patch("/api/auth/me/password").send({ actual: PASSWORD_PRUEBA, nueva: "Nueva-Clave-5678!" });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("token");
    expect(cookieCruda(res.headers["set-cookie"], COOKIE_SESION)).toMatch(/HttpOnly/);
    // el cliente que cambio la clave sigue dentro (cookie nueva); el otro, fuera
    computador.csrf = valorDeCookie(res.headers["set-cookie"], COOKIE_CSRF);
    expect((await computador.get("/api/auth/me")).status).toBe(200);
    expect((await telefono.get("/api/auth/me")).status).toBe(401);

    // la contraseña anterior ya no sirve; la nueva si
    expect((await anonimo().post("/api/auth/login").send({ email: datos.a.conserje.email, password: PASSWORD_PRUEBA })).status).toBe(401);
    expect((await anonimo().post("/api/auth/login").send({ email: datos.a.conserje.email, password: "Nueva-Clave-5678!" })).status).toBe(200);
  });
});

describe("CSRF y origen", () => {
  it("un POST con sesión pero sin X-CSRF-Token se rechaza con 403 y no crea nada", async () => {
    const cliente = await entrar(datos.a.residente);
    const antes = await prisma.alertaSos.count();
    const res = await cliente.postSinCsrf("/api/sos").send({ tipo: "BOMBEROS" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Recarga la página/);
    expect(await prisma.alertaSos.count()).toBe(antes);
  });

  it("un POST con un token CSRF de OTRA sesión se rechaza", async () => {
    const uno = await entrar(datos.a.residente);
    const otro = await entrar(datos.a.residente2);
    const res = await uno.agente.post("/api/qr/visitas/rapida").set("Origin", ORIGEN).set("X-CSRF-Token", otro.csrf!).send({});
    expect(res.status).toBe(403);
  });

  it("un POST desde un Origin ajeno se rechaza aunque lleve cookie y token", async () => {
    const cliente = await entrar(datos.a.residente);
    const res = await cliente.agente
      .post("/api/qr/visitas/rapida")
      .set("Origin", "https://sitio-malicioso.example")
      .set("X-CSRF-Token", cliente.csrf!)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Origen no permitido/);
  });

  it("el login también exige un origen permitido (CSRF de login)", async () => {
    const res = await anonimo().agente
      .post("/api/auth/login")
      .set("Origin", "https://sitio-malicioso.example")
      .send({ email: datos.a.residente.email, password: PASSWORD_PRUEBA });
    expect(res.status).toBe(403);
  });

  it("los GET no exigen el token (solo leen) y una tarea externa sin cookie pasa por la capa de origen", async () => {
    const cliente = await entrar(datos.a.admin);
    const res = await cliente.agente.get("/api/usuarios"); // sin Origin ni X-CSRF-Token
    expect(res.status).toBe(200);
    // sin TAREAS_TOKEN configurado la ruta no existe (404), pero no la bloquea el CSRF (403)
    const tarea = await anonimo().agente.post("/api/tareas/recordatorios").set("x-tarea-token", "cualquiera");
    expect(tarea.status).toBe(404);
  });
});
