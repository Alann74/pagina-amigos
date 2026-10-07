import { expect, type Page } from "@playwright/test";

export const PRICE_RE = /\$(\d{1,3}(?:\.\d{3})*)/;
export const parsePrice = (s: string) => Number(s.replace(/[$.]/g, ""));

/** Entra a un producto disponible del listado y lo agrega al carrito con el primer talle con stock. */
export async function addFirstAvailableProduct(page: Page, index = 0, quantity = 1) {
  await page.goto("/productos");
  const cards = page.getByTestId("product-card");
  await expect(cards.first()).toBeVisible();
  await cards.nth(index).locator("a").first().click();
  await expect(page.getByTestId("product-name")).toBeVisible();
  const name = (await page.getByTestId("product-name").textContent())?.trim() ?? "";
  const sizes = page.getByTestId("size-option");
  const count = await sizes.count();
  for (let i = 0; i < count; i++) {
    const label = (await sizes.nth(i).getAttribute("aria-label")) ?? "";
    if (!label.includes("sin stock")) {
      await sizes.nth(i).click();
      break;
    }
  }
  for (let q = 1; q < quantity; q++) await page.getByRole("button", { name: "Sumar" }).click();
  const isMobile = (page.viewportSize()?.width ?? 1000) < 1024;
  await page.getByTestId(isMobile ? "add-to-cart" : "add-to-cart-desktop").click();
  await expect(page.getByTestId("cart-drawer")).toBeVisible();
  await page.getByTestId("cart-drawer").getByRole("button", { name: "Cerrar" }).last().click();
  return name;
}
