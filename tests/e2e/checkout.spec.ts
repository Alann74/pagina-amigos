import { expect, test } from "@playwright/test";
import { addFirstAvailableProduct, parsePrice } from "./helpers";

test("agregar al carrito → completar datos → mensaje de WhatsApp correcto y pedido guardado", async ({ page, context }, testInfo) => {
  const isDesktop = testInfo.project.name === "desktop";
  let waUrl: string | null = null;
  await context.route(/https:\/\/(wa\.me|api\.whatsapp\.com)\/.*/, async (route) => {
    waUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>WhatsApp</body></html>" });
  });

  const first = await addFirstAvailableProduct(page, 0, 1);
  const second = await addFirstAvailableProduct(page, 1, 2);
  await expect(page.getByTestId("cart-count").first()).toContainText("3");

  await page.goto("/carrito");
  await expect(page.getByTestId("cart-line")).toHaveCount(2);
  await page.getByLabel("Nombre").fill("Prueba Automática");
  await page.getByLabel("Teléfono / WhatsApp").fill("341 555-0000");
  await page.getByText(/^Retiro en/).click();
  await page.getByText("Transferencia", { exact: true }).click();
  await page.getByLabel(/Comentario/).fill("Test e2e, ignorar");

  const popupPromise = isDesktop ? context.waitForEvent("page") : null;
  await page.getByTestId("send-order").click();
  if (popupPromise) await popupPromise;

  await expect.poll(() => waUrl, { timeout: 15_000 }).not.toBeNull();
  // En mobile la misma pestaña navega a WhatsApp; volvemos para ver la confirmación
  if (!isDesktop && /wa\.me|whatsapp/.test(page.url())) await page.goBack();
  await expect(page).toHaveURL(/\/pedido\//);

  const text = new URL(waUrl!).searchParams.get("text") ?? "";
  expect(text).toMatch(/^Hola INEDITA! Quiero hacer este pedido #INE-\d{4,}:/);
  expect(text).toContain(`• ${first} (art. `);
  expect(text).toContain(`• ${second} (art. `);
  expect(text).toMatch(/— Talle [^\n]+ — x2 — \$[\d.]+/);
  expect(text).toContain("Nombre: Prueba Automática");
  expect(text).toContain("Teléfono: 341 555-0000");
  expect(text).toContain("Entrega: Retiro en Mitre 830");
  expect(text).toContain("Pago: Transferencia");
  expect(text).toContain("Comentario: Test e2e, ignorar");

  // Totales: subtotal = suma de líneas; total efectivo = subtotal con 10% OFF
  const lineTotals = [...text.matchAll(/^• .* — (\$[\d.]+)$/gm)].map((m) => parsePrice(m[1]));
  expect(lineTotals).toHaveLength(2);
  const subtotal = parsePrice(text.match(/Subtotal: (\$[\d.]+)/)![1]);
  const cash = parsePrice(text.match(/Total con 10% OFF efectivo\/transferencia: (\$[\d.]+)/)![1]);
  expect(subtotal).toBe(lineTotals.reduce((a, b) => a + b, 0));
  expect(cash).toBe(Math.round(subtotal * 0.9));
  // Formato argentino: punto de miles, sin decimales
  expect(text).not.toMatch(/\$\d+,\d{2}/);

  // El pedido quedó guardado: la página de confirmación muestra el mismo mensaje
  await expect(page.getByTestId("order-message")).toHaveText(text);
  await expect(page.getByTestId("open-whatsapp")).toHaveAttribute("href", /wa\.me\/5493412550777\?text=/);
  // El carrito se vació
  await expect(page.getByTestId("cart-count")).toHaveCount(0);
});

test("el carrito persiste al recargar (también en el navegador de Instagram)", async ({ page }) => {
  await addFirstAvailableProduct(page, 2, 1);
  await page.reload();
  await expect(page.getByTestId("cart-count").first()).toContainText("1");
  await page.goto("/");
  await expect(page.getByTestId("cart-count").first()).toContainText("1");
});

test("consultar por WhatsApp desde la ficha arma el mensaje con producto y link", async ({ page }) => {
  await page.goto("/productos");
  await page.getByTestId("product-card").first().locator("a").first().click();
  const name = (await page.getByTestId("product-name").textContent())?.trim() ?? "";
  await page.getByTestId("size-option").first().click();
  const href = (await page.getByTestId("consult-whatsapp").getAttribute("href")) ?? "";
  const text = new URL(href).searchParams.get("text") ?? "";
  expect(text).toContain(`Hola INEDITA! Quiero consultar por ${name} – Talle`);
  expect(text).toMatch(/– https?:\/\/[^ ]+\/producto\//);
});
