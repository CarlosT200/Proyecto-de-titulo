import { expect, type APIResponse, type Page } from "@playwright/test";

// Cuentas del seed de demostracion (datos ficticios; la contraseña es publica a proposito y solo
// existe en bases de prueba/demostracion: ver backend/src/lib/guardiaSeed.ts).
export const CUENTAS = {
  admin: "admin@habitasmart.cl",
  residente: "residente@habitasmart.cl",
  conserje: "conserje@habitasmart.cl",
} as const;
export const PASSWORD_DEMO = "Habita2026!";

export async function entrar(page: Page, email: string, password = PASSWORD_DEMO) {
  await page.goto("/login");
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/^contraseña/i).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function salir(page: Page) {
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/login/);
}

// Llama a la API con la sesion del navegador (cookie HttpOnly) y la cabecera anti-CSRF que leeria
// la app desde su cookie. Sirve para preparar datos cuando la pantalla no es lo que se prueba.
export async function api(page: Page, metodo: "GET" | "POST" | "PATCH" | "DELETE", ruta: string, datos?: unknown): Promise<APIResponse> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === "habitasmart_csrf")?.value ?? "";
  const origen = new URL(page.url()).origin;
  return page.request.fetch(ruta, {
    method: metodo,
    headers: { Origin: origen, "X-CSRF-Token": csrf },
    data: datos,
  });
}

// Fecha (YYYY-MM-DD) en Chile, a N dias de hoy.
export function diaEnChile(desplazamiento: number): string {
  const d = new Date(Date.now() + desplazamiento * 86_400_000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(d);
}
