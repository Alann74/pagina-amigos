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

test("mayorista: se registra, el admin lo aprueba y entra con su código personal", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Se prueba en escritorio");
  const password = adminPassword();
  test.skip(!password, "Falta ADMIN_PASSWORD");
  const stamp = Date.now();
  const name = `E2E Mayorista ${stamp}`;

  // Admin: acceso mayorista activo, sin mínimos
  await page.goto("/admin/mayoristas");
  await page.getByTestId("admin-password").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/admin/mayoristas");
  const toggle = page.getByRole("switch", { name: "Acceso mayorista activo" });
  if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
  await page.locator("#ws-min").fill("");
  await page.locator("#ws-units").fill("0");
  await page.locator("#ws-first-units").fill("25");
  await page.getByTestId("wholesale-save").click();
  await expect(page.getByText("Acceso mayorista activo").last()).toBeVisible();

  const ctx = await browser.newContext();
  const shop = await ctx.newPage();
  // Precio de tienda del primer producto (para comparar después)
  await shop.goto("/productos");
  const firstCard = shop.getByTestId("product-card").first();
  const retailText = (await firstCard.locator("[data-price]").first().textContent())?.trim() ?? "";

  // Mayorista: se registra con sus datos
  await shop.goto("/mayoristas");
  await shop.getByTestId("wholesale-signup-send").click();
  await expect(shop.getByText("Completá: Nombre y apellido")).toBeVisible();
  await shop.getByTestId("ws-name").fill(name);
  await shop.getByTestId("ws-business").fill("Showroom de prueba");
  await shop.getByTestId("ws-phone").fill(`341 ${String(stamp).slice(-7)}`);
  await shop.getByTestId("ws-email").fill("mal@");
  await shop.getByTestId("ws-city").fill("Funes, Santa Fe");
  await shop.getByTestId("ws-instagram").fill("@showroom.prueba");
  await shop.getByText("Vendo online / redes").click();
  await shop.getByTestId("wholesale-signup-send").click();
  await expect(shop.getByText("Ingresá un mail válido")).toBeVisible();
  await shop.getByTestId("ws-email").fill(`e2e-mayor-${stamp}@inedita.test`);
  await shop.getByTestId("wholesale-signup-send").click();
  await expect(shop.getByTestId("wholesale-signup-done")).toContainText("Recibimos tus datos");
  await expect(shop.getByTestId("wholesale-first-min")).toHaveText("Para clientas nuevas, la primera compra por mayor es de mínimo 25 prendas.");
  // Sin aprobar todavía no hay código que sirva
  await shop.goto("/mayoristas");
  await shop.getByTestId("wholesale-tab-codigo").click();
  await shop.getByTestId("wholesale-code").fill("NADA-NADA");
  await shop.getByTestId("wholesale-enter").click();
  await expect(shop.locator("p[role=alert]")).toHaveText("Código incorrecto");

  // Admin: lo ve pendiente con sus datos y lo aprueba
  await page.reload();
  const card = page.getByTestId("wholesale-pending").filter({ hasText: name });
  await expect(card).toContainText("Showroom de prueba");
  await expect(card).toContainText("@showroom.prueba");
  await expect(card).toContainText("Vendo online / redes");
  await card.getByTestId("wholesale-approve").click();
  const code = (await page.getByTestId("wholesale-new-code").first().textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const send = page.getByTestId("wholesale-send-code").first();
  await expect(send).toHaveAttribute("href", new RegExp(`^https://wa\\.me/549341${String(stamp).slice(-7)}\\?text=.*mayoristas%3Fcodigo%3D${code}`));
  // Clienta nueva (lo que viene marcado): el WhatsApp le avisa el mínimo de la primera compra
  const approvalText = new URL((await send.getAttribute("href"))!).searchParams.get("text") ?? "";
  expect(approvalText).toContain("Tu primera compra tiene un mínimo de 25 prendas.");
  await expect(page.getByTestId("wholesale-customer-row").filter({ hasText: name })).toBeVisible();

  // El link del WhatsApp entra directo a la tienda de siempre, con los precios por mayor
  await shop.goto(`/mayoristas?codigo=${code}`);
  await shop.waitForURL((u) => u.pathname === "/");
  await expect(shop.getByText("Modo mayorista · precios por mayor")).toBeVisible();
  await shop.goto("/productos");
  await expect(firstCard).toBeVisible();
  await expect(firstCard).not.toContainText(/Precio (por mayor|de tienda)/);
  await expect(firstCard.locator("[data-price]").first()).not.toHaveText(retailText);
  await shop.goto("/mayoristas");
  await expect(shop.getByTestId("wholesale-active")).toContainText("Hola E2E!");

  // Primera compra de una clienta nueva: con 1 prenda no se puede (mínimo 25)
  await ctx.route(/https:\/\/(wa\.me|api\.whatsapp\.com)\/.*/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>WhatsApp</body></html>" }));
  await addFirstAvailableProduct(shop);
  await shop.goto("/carrito");
  await expect(shop.getByTestId("wholesale-min-units").first()).toHaveText("Primera compra: mínimo 25 prendas (llevás 1)");
  await shop.getByLabel("Nombre").fill(`Pedido ${name}`);
  await shop.getByLabel("Teléfono / WhatsApp").fill("341 555-0000");
  await shop.getByText(/^Retiro en/).click();
  await shop.getByText("Transferencia", { exact: true }).click();
  await shop.getByTestId("send-order").click();
  await expect(shop.getByRole("alert").filter({ hasText: "Tu primera compra por mayor tiene un mínimo de 25 prendas (llevás 1)." })).toBeVisible();

  // El admin la marca como clienta de antes: sin mínimo, y su pedido queda a su nombre en el panel
  await page.goto("/admin/mayoristas");
  await page.getByTestId("wholesale-customer-row").filter({ hasText: name }).getByTestId("wholesale-existing").selectOption("si");
  await expect(page.getByText(`${name}: ya es clienta, sin mínimo en la primera compra`)).toBeVisible();
  await shop.reload();
  await expect(shop.getByTestId("cart-line")).toHaveCount(1);
  await expect(shop.getByTestId("wholesale-min-units")).toHaveCount(0);
  await shop.getByLabel("Nombre").fill(`Pedido ${name}`);
  await shop.getByLabel("Teléfono / WhatsApp").fill("341 555-0000");
  await shop.getByText(/^Retiro en/).click();
  await shop.getByText("Transferencia", { exact: true }).click();
  const waPage = ctx.waitForEvent("page");
  await shop.getByTestId("send-order").click();
  await (await waPage).close();
  await expect(shop).toHaveURL(/\/pedido\//);
  await page.goto("/admin/pedidos");
  await page.getByTestId("orders-list").getByRole("link", { name: new RegExp(`Pedido ${name}`) }).click();
  await expect(page.getByText("Pedido mayorista (precios por mayor)")).toBeVisible();
  await expect(page.getByRole("link", { name: `${name} · Showroom de prueba` })).toBeVisible();
  await page.goto("/admin/mayoristas");

  // Admin le quita el acceso: deja de ver los precios por mayor
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("wholesale-customer-row").filter({ hasText: name }).getByRole("button", { name: "Quitar acceso" }).click();
  await expect(page.getByText(`${name}: Acceso quitado`)).toBeVisible();
  await shop.goto("/");
  await shop.reload();
  await expect(shop.getByText("Modo mayorista · precios por mayor")).toBeHidden();
  await ctx.close();
});
