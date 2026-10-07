import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { addFirstAvailableProduct } from "./helpers";

function adminPassword(): string | undefined {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const envFile = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) return undefined;
  return fs.readFileSync(envFile, "utf8").split("\n").find((l) => l.startsWith("ADMIN_PASSWORD="))?.slice("ADMIN_PASSWORD=".length).trim();
}

test.describe("pop-up de bienvenida", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("suscribirse da un código que se aplica en la bolsa", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-375", "Alcanza con probarlo en celular");
    await page.goto("/");
    const popup = page.getByTestId("welcome-popup");
    await expect(popup).toBeVisible({ timeout: 20_000 });
    await page.locator("#welcome-email").fill(`e2e-${Date.now()}@inedita.test`);
    await page.locator("#welcome-phone").fill(`341 ${String(Date.now()).slice(-7)}`);
    await page.getByTestId("welcome-submit").click();
    await expect(page.getByTestId("welcome-done")).toContainText("HOLA-");
    await page.getByRole("button", { name: "Ver la colección" }).click();
    await expect(popup).toBeHidden();

    await addFirstAvailableProduct(page);
    await page.goto("/carrito");
    await expect(page.getByTestId("welcome-applied")).toBeVisible();
    await expect(page.getByTestId("cart-cash-total").first()).toBeVisible();
    // No vuelve a aparecer
    await page.goto("/productos");
    await page.waitForTimeout(1500);
    await expect(popup).toBeHidden();
  });
});

test("acceso mayorista con código", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Se prueba en escritorio");
  const password = adminPassword();
  test.skip(!password, "Falta ADMIN_PASSWORD");

  // Configurar el código desde el admin
  await page.goto("/admin/mayoristas");
  await page.getByTestId("admin-password").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/admin/mayoristas");
  const toggle = page.getByRole("switch", { name: "Acceso mayorista activo" });
  if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
  await page.locator("#ws-code").fill("E2EMAYOR");
  await page.locator("#ws-min").fill("");
  await page.locator("#ws-units").fill("0");
  await page.getByTestId("wholesale-save").click();
  await expect(page.getByText("Acceso mayorista activo").last()).toBeVisible();

  // Mayorista: código incorrecto y correcto
  const ctx = await browser.newContext();
  const shop = await ctx.newPage();
  await shop.goto("/mayoristas");
  await shop.getByTestId("wholesale-code").fill("nada");
  await shop.getByTestId("wholesale-enter").click();
  await expect(shop.locator("p[role=alert]")).toHaveText("Código incorrecto");
  await shop.getByTestId("wholesale-code").fill("e2emayor");
  await shop.getByTestId("wholesale-enter").click();
  await shop.waitForURL("**/productos");
  await expect(shop.getByText("Modo mayorista · precios por mayor")).toBeVisible();
  await expect(shop.getByTestId("product-card").first()).toContainText(/Precio (por mayor|de tienda)/);
  // Salir vuelve a los precios de la tienda
  await shop.getByRole("button", { name: "Salir" }).click();
  await shop.waitForURL((u) => u.pathname === "/");
  await expect(shop.getByText("Modo mayorista · precios por mayor")).toBeHidden();
  await ctx.close();
});
