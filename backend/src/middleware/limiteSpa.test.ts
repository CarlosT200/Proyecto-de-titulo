import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { crearLimiteSpa, LIMITE_SPA_POR_MINUTO, VENTANA_SPA_MS } from "./limiteSpa";

// Mini app con la misma forma que app.ts: rutas propias antes y el fallback "*" con el limite.
function appDePrueba(limite: number) {
  const app = express();
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("*", crearLimiteSpa(limite), (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.type("html").send("<!doctype html><title>SPA</title>");
  });
  app.use((_req, res) => res.status(404).json({ error: "No encontrado" }));
  return app;
}

describe("limite del fallback de la SPA (CodeQL js/missing-rate-limiting)", () => {
  it("es generoso: al menos 300 cargas por minuto por IP (redes compartidas y demostraciones)", () => {
    expect(LIMITE_SPA_POR_MINUTO).toBeGreaterThanOrEqual(300);
    expect(VENTANA_SPA_MS).toBe(60_000);
  });

  it("al superar el limite responde 429 con un mensaje entendible", async () => {
    const app = appDePrueba(3);
    for (let i = 0; i < 3; i++) expect((await request(app).get("/residente/qr")).status).toBe(200);
    const bloqueado = await request(app).get("/residente/qr");
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.text).toMatch(/Espera un momento/);
  });

  it("usa las cabeceras estandar RateLimit y no las antiguas X-RateLimit-*", async () => {
    const res = await request(appDePrueba(5)).get("/login");
    expect(res.headers["ratelimit"]).toBeDefined();
    expect(res.headers["ratelimit-policy"]).toBeDefined();
    expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
    expect(res.headers["x-ratelimit-remaining"]).toBeUndefined();
  });

  it("no afecta a las rutas declaradas antes del fallback (/health) aunque el limite este agotado", async () => {
    const app = appDePrueba(1);
    await request(app).get("/inicio");
    expect((await request(app).get("/inicio")).status).toBe(429);
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.headers["ratelimit"]).toBeUndefined();
    }
  });

  it("las rutas /api que caen al fallback no se cuentan ni se limitan (siguen al 404)", async () => {
    const app = appDePrueba(1);
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/api/no-existe");
      expect(res.status).toBe(404);
      expect(res.headers["ratelimit"]).toBeUndefined();
    }
    expect((await request(app).get("/inicio")).status).toBe(200);
  });
});
