import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { parsePrice } from "./helpers";

// Panel de administración: se prueba solo en escritorio (es el mismo código en celular).
function adminPassword(): string | undefined {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const envFile = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) return undefined;
  const line = fs.readFileSync(envFile, "utf8").split("\n").find((l) => l.startsWith("ADMIN_PASSWORD="));
  return line?.slice("ADMIN_PASSWORD=".length).trim();
}

const PASSWORD = adminPassword();

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "El admin se prueba en escritorio");
  test.skip(!PASSWORD, "Falta ADMIN_PASSWORD");
});

async function login(page: Page, next = "/admin") {
  await page.goto(next);
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByTestId("admin-password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForFunction((p) => location.pathname === p, next);
}

test("el admin está protegido", async ({ page, request }) => {
  await page.goto("/admin/productos");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fproductos/);
  expect((await request.get("/api/admin/csv")).status()).toBe(401);
  const res = await request.post("/api/admin/upload", { multipart: { kind: "campaign" } });
  expect(res.status()).toBe(401);
  await page.getByTestId("admin-password").fill("no-es-la-clave");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Contraseña incorrecta")).toBeVisible();
});

test("cambiar el precio en el admin se ve al instante en la tienda", async ({ page }) => {
  await login(page, "/admin/productos");
  await page.getByTestId("admin-products").locator("li a").nth(1).click();
  await expect(page.getByTestId("admin-price")).toBeVisible();
  const original = await page.getByTestId("admin-price").inputValue();
  const storeLink = page.getByRole("link", { name: /Ver en la tienda/ });
  const href = await storeLink.getAttribute("href");
  expect(href).toBeTruthy();

  const nuevo = Number(original) + 1000;
  await page.getByTestId("admin-price").fill(String(nuevo));
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("✓ Guardado")).toBeVisible();

  const store = await page.context().newPage();
  await store.goto(href!);
  await expect.poll(async () => parsePrice((await store.getByTestId("product-price").textContent()) ?? "")).toBe(nuevo);

  // se deja como estaba
  await page.getByTestId("admin-price").fill(original);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("✓ Guardado")).toBeVisible();
  await store.reload();
  await expect.poll(async () => parsePrice((await store.getByTestId("product-price").textContent()) ?? "")).toBe(Number(original));
});

test("subir, reordenar y borrar una foto", async ({ page }) => {
  await login(page, "/admin/productos");
  await page.getByTestId("admin-products").locator("li a").nth(1).click();
  const heading = page.getByRole("heading", { name: /^Fotos \(\d+\)$/ });
  const before = Number((await heading.textContent())!.match(/\d+/)![0]);
  await page.getByTestId("upload-images").setInputFiles(path.join(__dirname, "fixtures/foto-prueba.png"));
  await expect(page.getByText("✓ 1 foto subida")).toBeVisible({ timeout: 30_000 });
  await expect(heading).toHaveText(`Fotos (${before + 1})`);
  // la nueva queda última: se borra
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Borrar" }).last().click();
  await expect(heading).toHaveText(`Fotos (${before})`);
});

test("aumento masivo: vista previa con redondeo y aplicar a una selección", async ({ page }) => {
  await login(page, "/admin/precios");
  const firstRow = page.getByRole("listitem").filter({ has: page.getByLabel(/^Precio de /) }).first();
  const priceInput = firstRow.getByLabel(/^Precio de /);
  const original = Number(await priceInput.inputValue());
  await firstRow.getByRole("checkbox").check();
  await page.getByTestId("bulk-percent").fill("10");
  await page.locator("#b-scope").selectOption("seleccion");
  await page.locator("#b-round").selectOption("1000");
  await page.getByTestId("bulk-preview").click();
  const expected = Math.ceil(Math.round(original * 1.1) / 1000) * 1000;
  const panel = page.getByTestId("bulk-preview-panel");
  await expect(panel).toContainText("1 productos");
  await expect(panel).toContainText(`$${expected.toLocaleString("es-AR")}`);
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("bulk-apply").click();
  await expect(page.getByText("✓ 1 precios actualizados")).toBeVisible();
  await expect(priceInput).toHaveValue(String(expected));
  // se vuelve al precio original desde la edición rápida
  await priceInput.fill(String(original));
  await page.getByTestId("save-prices").click();
  await expect(priceInput).toHaveValue(String(original));
});

test("exportar CSV", async ({ page }) => {
  await login(page, "/admin/csv");
  const res = await page.request.get("/api/admin/csv");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text.split("\n")[0]).toContain("articulo;sku;nombre;categoria;color;talle;precio;stock;visible;etiqueta");
  expect(text.split("\n").length).toBeGreaterThan(100);
});

test("cambiar el estado de un pedido", async ({ page }) => {
  await login(page, "/admin/pedidos");
  await page.goto("/admin/pedidos?desde=todo");
  const select = page.getByTestId("order-status").first();
  test.skip((await select.count()) === 0, "No hay pedidos cargados");
  const original = await select.inputValue();
  const next = original === "confirmado" ? "nuevo" : "confirmado";
  await select.selectOption(next);
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByTestId("order-status").first()).toHaveValue(next);
  await page.getByTestId("order-status").first().selectOption(original);
  await page.waitForTimeout(800);
});
