import { expect, test, type Page } from "@playwright/test";
import { api, CUENTAS, diaEnChile, entrar } from "./ayudas";

test.describe("SOS (solo modo demostración)", () => {
  test("el residente activa un SOS: no se abre ninguna llamada y conserjería recibe la alerta [DEMO]", async ({ browser }) => {
    const residente = await browser.newPage();
    // Registro de cualquier intento de abrir "tel:" (navegación o petición).
    const intentosTel: string[] = [];
    residente.on("framenavigated", (f) => f.url().startsWith("tel:") && intentosTel.push(f.url()));
    residente.on("request", (r) => r.url().startsWith("tel:") && intentosTel.push(r.url()));

    await entrar(residente, CUENTAS.residente);
    await expect(residente.getByTestId("banner-modo-demo")).toBeVisible();
    const config = await residente.request.get("/api/config");
    expect(await config.json()).toMatchObject({ sosModoDemo: true });

    const urlAntes = residente.url();
    await residente.getByRole("button", { name: "Emergencia SOS" }).click();
    const dialogo = residente.getByRole("dialog", { name: "Emergencia" });
    await expect(dialogo.getByTestId("sos-aviso-modo")).toContainText("Modo demostración");
    await dialogo.getByRole("button", { name: /Bomberos/ }).click();
    await expect(residente.getByText(/No se llamó a ningún número real/)).toBeVisible();

    expect(intentosTel).toEqual([]);
    expect(residente.url()).toBe(urlAntes);

    const conserje = await browser.newPage();
    await entrar(conserje, CUENTAS.conserje);
    await conserje.goto("/alertas-sos");
    await expect(conserje.getByText(/emergencia(s)? activa/)).toBeVisible();
    await conserje.getByRole("button", { name: "Notificaciones" }).click();
    await expect(conserje.getByText(/\[DEMO\] 🚨 Alerta SOS: Bomberos/).first()).toBeVisible();
    await residente.close();
    await conserje.close();
  });
});

async function codigoDeInvitado(page: Page, nombre: string): Promise<string> {
  await page.goto("/qr");
  await page.getByRole("button", { name: "QR para un invitado" }).click();
  await page.getByLabel("Nombre del invitado (opcional)").fill(nombre);
  await page.getByRole("button", { name: "Generar QR" }).click();
  const modal = page.getByRole("dialog", { name: `QR de ${nombre}` });
  await expect(modal).toBeVisible();
  const texto = await modal.innerText();
  const codigo = texto.match(/\b([A-Z0-9]{3}-[A-Z0-9]{3})\b/)?.[1];
  expect(codigo, "el modal muestra el código manual").toBeTruthy();
  return codigo!;
}

async function validar(page: Page, codigo: string) {
  await page.getByLabel("Código").fill(codigo);
  await page.getByRole("button", { name: "Validar" }).click();
}

test.describe("visitas y QR", () => {
  test("el residente crea una visita con QR y conserjería la valida una sola vez", async ({ browser }) => {
    const residente = await browser.newPage();
    await entrar(residente, CUENTAS.residente);
    const codigo = await codigoDeInvitado(residente, "Visita E2E");

    // la visita queda en la lista de visitas autorizadas
    await residente.keyboard.press("Escape");
    await expect(residente.getByText("Visita E2E").first()).toBeVisible();

    const conserje = await browser.newPage();
    await entrar(conserje, CUENTAS.conserje);
    await conserje.goto("/validar");
    await validar(conserje, codigo);
    await expect(conserje.getByText("Acceso autorizado")).toBeVisible();

    // QR de un solo uso: el segundo intento se rechaza
    await validar(conserje, codigo);
    await expect(conserje.getByText("Acceso rechazado")).toBeVisible();
    await residente.close();
    await conserje.close();
  });
});

test.describe("encomiendas", () => {
  test("conserjería registra una encomienda y la entrega", async ({ page }) => {
    await entrar(page, CUENTAS.conserje);
    await page.goto("/encomiendas?registrar=1");
    await page.getByLabel("Residente", { exact: true }).selectOption({ label: "Roberto Residente (Torre A 101)" });
    await page.getByLabel("Remitente o empresa (opcional)").selectOption({ label: "Otro…" });
    await page.getByLabel("Especifica el remitente").fill("Tienda E2E");
    await page.getByRole("button", { name: "Registrar y notificar" }).click();
    await expect(page.getByText(/registrada|notific/i).first()).toBeVisible();

    const fila = page.getByRole("row").filter({ hasText: "Tienda E2E" }).first();
    await fila.getByRole("button", { name: "Entregar" }).click();
    const detalle = page.getByRole("dialog", { name: "Encomienda de Tienda E2E" });
    await detalle.getByLabel("Nombre de quien la retira").fill("Roberto Residente");
    await detalle.getByRole("button", { name: "Confirmar entrega" }).click();
    await expect(page.getByText("Encomienda entregada.")).toBeVisible();
  });
});

test.describe("reservas", () => {
  test("una reserva se confirma y un segundo intento en el mismo horario se rechaza por conflicto", async ({ page }) => {
    await entrar(page, CUENTAS.residente);
    const espacios = await (await api(page, "GET", "/api/condominio/espacios-comunes?activos=true")).json();
    const quincho = espacios.find((e: { nombre: string }) => e.nombre === "Quincho");
    const fecha = diaEnChile(20);
    const datos = { espacioComunId: quincho.id, fecha, horaInicio: "15:00", horaFin: "17:00" };

    const primera = await api(page, "POST", "/api/reservas", datos);
    expect(primera.status()).toBe(201);
    const conflicto = await api(page, "POST", "/api/reservas", { ...datos, horaInicio: "16:00", horaFin: "18:00" });
    expect(conflicto.status()).toBe(409);
    expect((await conflicto.json()).error).toMatch(/ya se encuentra reservado/);

    await page.goto("/reservas");
    await expect(page.getByText("Quincho").first()).toBeVisible();
  });
});

test.describe("gastos comunes", () => {
  test("el residente consulta su estado de cuenta y la administración la morosidad", async ({ browser }) => {
    const residente = await browser.newPage();
    await entrar(residente, CUENTAS.residente);
    await residente.goto("/gastos-comunes");
    await expect(residente.getByRole("heading", { level: 1 })).toContainText(/Gastos comunes/i);
    await expect(residente.getByText(/\$\s?\d{1,3}(\.\d{3})+/).first()).toBeVisible();

    const admin = await browser.newPage();
    await entrar(admin, CUENTAS.admin);
    await admin.goto("/gastos-comunes");
    await expect(admin.getByRole("heading", { level: 1 })).toContainText(/Gastos comunes/i);
    await expect(admin.getByText(/\$\s?\d{1,3}(\.\d{3})+/).first()).toBeVisible();
    await residente.close();
    await admin.close();
  });
});
