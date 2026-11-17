import { expect, test } from "@playwright/test";
import { api, CUENTAS, entrar, salir } from "./ayudas";

test.describe("inicio de sesión y roles", () => {
  test("ADMIN entra, ve su panel y navega por el menú", async ({ page }) => {
    await entrar(page, CUENTAS.admin);
    await expect(page.getByRole("link", { name: "Residentes" })).toBeVisible();
    await page.getByRole("link", { name: "Residentes" }).click();
    await expect(page).toHaveURL(/\/residentes/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Residentes");
    await page.getByRole("link", { name: "Registro de actividad" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("RESIDENTE entra y llega a su inicio con el botón SOS", async ({ page }) => {
    await entrar(page, CUENTAS.residente);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Roberto");
    await expect(page.getByRole("button", { name: "Emergencia SOS" })).toBeVisible();
  });

  test("CONSERJE entra y navega a encomiendas y validación de QR", async ({ page }) => {
    await entrar(page, CUENTAS.conserje);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Carlos");
    await page.goto("/encomiendas");
    await expect(page.getByRole("heading", { level: 1, name: "Encomiendas" })).toBeVisible();
    await page.goto("/validar");
    await expect(page.getByRole("heading", { level: 1, name: "Validar acceso QR" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Emergencia SOS" })).toHaveCount(0);
  });

  test("la sesión vive en una cookie HttpOnly: no hay token en localStorage ni sessionStorage", async ({ page, context }) => {
    await entrar(page, CUENTAS.residente);
    const almacenamiento = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      sesion: Object.keys(sessionStorage),
      cookiesLegibles: document.cookie,
    }));
    expect(almacenamiento.local).not.toContain("habitasmart_token");
    expect(almacenamiento.sesion).toHaveLength(0);
    expect(almacenamiento.cookiesLegibles).not.toContain("habitasmart_sesion");
    const cookie = (await context.cookies()).find((c) => c.name === "habitasmart_sesion");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });

  test("un rol incorrecto no accede: la pantalla no existe para él y la API responde 403", async ({ page }) => {
    await entrar(page, CUENTAS.residente);
    await page.goto("/auditoria");
    await expect(page).toHaveURL(/\/$/);
    const respuesta = await api(page, "GET", "/api/auditoria");
    expect(respuesta.status()).toBe(403);
    const crearUsuario = await api(page, "POST", "/api/usuarios", { nombre: "X" });
    expect(crearUsuario.status()).toBe(403);
  });

  test("cerrar sesión revoca la sesión: volver atrás no recupera el acceso", async ({ page }) => {
    await entrar(page, CUENTAS.conserje);
    await salir(page);
    await page.goto("/encomiendas");
    await expect(page).toHaveURL(/\/login/);
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(401);
  });
});
