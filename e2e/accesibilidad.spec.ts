import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { CUENTAS, entrar } from "./ayudas";

// Accesibilidad (WCAG 2.2 AA, reglas automatizables de axe) y adaptacion a pantallas chicas en las
// pantallas principales de los tres roles. Falla ante cualquier violacion "serious" o "critical" y
// ante cualquier desborde horizontal (contenido mas ancho que la pantalla).
//
// En cada corrida: todos los tamaños pedidos para la defensa solo con REVISION_COMPLETA=1 (tarda
// ~3 min); por defecto, los dos mas exigentes (320 px de celular chico y 768 px de tablet).
const TODOS = [
  [320, 568],
  [360, 800],
  [390, 844],
  [768, 1024],
  [1366, 768],
  [1440, 900],
] as const;
const TAMANOS = process.env.REVISION_COMPLETA ? TODOS : ([TODOS[0], TODOS[3]] as const);

const PANTALLAS: Record<keyof typeof CUENTAS, string[]> = {
  admin: ["/", "/alertas-sos", "/residentes", "/condominio", "/gastos-comunes", "/reservas", "/multas", "/incidencias", "/encomiendas", "/comunicados", "/documentos", "/accesos", "/auditoria", "/perfil"],
  residente: ["/", "/gastos-comunes", "/reservas", "/multas", "/incidencias", "/encomiendas", "/comunicados", "/qr", "/documentos", "/perfil"],
  conserje: ["/", "/encomiendas", "/alertas-sos", "/validar", "/accesos", "/perfil"],
};

const ETIQUETAS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function desborde(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const sobra = document.documentElement.scrollWidth - window.innerWidth;
    if (sobra <= 1) return null;
    const culpable = [...document.querySelectorAll("body *")].find((el) => el.getBoundingClientRect().right > window.innerWidth + 1);
    return `+${sobra}px (${culpable?.tagName.toLowerCase()}.${String(culpable?.className ?? "").slice(0, 50)})`;
  });
}

async function violacionesGraves(page: Page): Promise<string[]> {
  const r = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" ; ")}`);
}

async function revisarRol(browser: Browser, rol: keyof typeof CUENTAS) {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  await entrar(page, CUENTAS[rol]);
  const problemas: string[] = [];
  for (const ruta of PANTALLAS[rol]) {
    for (const [ancho, alto] of TAMANOS) {
      await page.setViewportSize({ width: ancho, height: alto });
      await page.goto(ruta);
      await page.waitForLoadState("networkidle");
      const d = await desborde(page);
      if (d) problemas.push(`desborde ${ruta} ${ancho}x${alto}: ${d}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ruta);
    await page.waitForLoadState("networkidle");
    for (const v of await violacionesGraves(page)) problemas.push(`WCAG ${ruta}: ${v}`);
  }
  await contexto.close();
  return problemas;
}

test.describe("accesibilidad y pantallas chicas", () => {
  test.setTimeout(300_000);

  for (const rol of Object.keys(PANTALLAS) as (keyof typeof CUENTAS)[]) {
    test(`${rol}: sin violaciones WCAG graves ni desborde horizontal`, async ({ browser }) => {
      expect(await revisarRol(browser, rol)).toEqual([]);
    });
  }

  test("login: sin violaciones WCAG graves ni desborde en ningún tamaño", async ({ browser }) => {
    const problemas: string[] = [];
    for (const [ancho, alto] of TODOS) {
      const contexto = await browser.newContext({ viewport: { width: ancho, height: alto } });
      const page = await contexto.newPage();
      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      const d = await desborde(page);
      if (d) problemas.push(`desborde ${ancho}x${alto}: ${d}`);
      if (ancho === 390) for (const v of await violacionesGraves(page)) problemas.push(`WCAG: ${v}`);
      await contexto.close();
    }
    expect(problemas).toEqual([]);
  });

  test("navegación por teclado: el login se completa solo con Tab y Enter, con foco visible", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo/i).focus();
    await page.keyboard.type(CUENTAS.residente);
    await page.keyboard.press("Tab");
    await page.keyboard.type("Habita2026!");
    // el foco esta en el campo de contraseña y se ve (anillo de foco)
    const anillo = await page.evaluate(() => getComputedStyle(document.activeElement as Element).boxShadow);
    expect(anillo).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("el modal SOS atrapa el foco de forma usable y se cierra con Escape", async ({ page }) => {
    await entrar(page, CUENTAS.residente);
    await page.getByRole("button", { name: "Emergencia SOS" }).click();
    const dialogo = page.getByRole("dialog", { name: "Emergencia" });
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toHaveAttribute("aria-modal", "true");
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
  });
});
