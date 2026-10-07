"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { categories, colors, orders, productImages, products, settings, variants, withdrawalRequests } from "@/db/schema";
import { ADMIN_COOKIE, checkPassword, createSessionToken } from "@/lib/admin-auth";
import { requireAdmin } from "@/lib/admin-guard";
import { TAGS } from "@/lib/catalog";
import { slugify, sizeOrder } from "@/lib/format";
import { roundPrice, type Rounding } from "@/lib/pricing";
import { clientIp, isBlocked, recordFailure } from "@/lib/rate-limit";
import { deleteFiles } from "@/lib/storage";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Datos inválidos" };
  console.error("[admin]", error);
  return { ok: false, error: error instanceof Error ? error.message : "Error inesperado" };
}

function catalogChanged() {
  updateTag(TAGS.catalog);
}

// ---------------------------------------------------------------- sesión

export async function login(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const key = `login:${clientIp(await headers())}`;
  if (isBlocked(key, 8, 15 * 60 * 1000)) return { error: "Demasiados intentos fallidos. Esperá 15 minutos." };
  if (!process.env.ADMIN_PASSWORD) return { error: "Falta configurar ADMIN_PASSWORD en Vercel." };
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    recordFailure(key);
    return { error: "Contraseña incorrecta" };
  }
  const { token, maxAge } = createSessionToken();
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logout() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

// ---------------------------------------------------------------- pedidos

const statusSchema = z.enum(["nuevo", "confirmado", "entregado", "cancelado"]);

export async function updateOrderStatus(orderId: number, status: string, note?: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = statusSchema.parse(status);
    await db
      .update(orders)
      .set({ status: parsed, ...(note !== undefined ? { adminNote: note.slice(0, 1000) } : {}) })
      .where(eq(orders.id, orderId));
    updateTag(TAGS.bestsellers);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateWithdrawalStatus(id: number, status: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db.update(withdrawalRequests).set({ status: z.enum(["nuevo", "en curso", "resuelto"]).parse(status) }).where(eq(withdrawalRequests.id, id));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- productos

const productSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  articleCode: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v || null)
    .nullable(),
  description: z.string().max(4000).default(""),
  categoryId: z.number().int().nullable(),
  price: z.number().int().min(1, "El precio tiene que ser mayor a 0").max(100_000_000),
  compareAtPrice: z.number().int().positive().nullable(),
  visible: z.boolean(),
  featured: z.boolean(),
});

export async function updateProduct(id: number, input: z.input<typeof productSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = productSchema.parse(input);
    if (data.visible) {
      const imgs = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, id)).limit(1);
      if (imgs.length === 0) return { ok: false, error: "Para publicarlo necesita al menos una foto." };
    }
    await db.update(products).set(data).where(eq(products.id, id));
    catalogChanged();
    return { ok: true, message: "Guardado" };
  } catch (e) {
    return fail(e);
  }
}

export async function setProductFlags(ids: number[], flags: { visible?: boolean; featured?: boolean; markNew?: boolean }): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (ids.length === 0) return { ok: true };
    const patch: Partial<typeof products.$inferInsert> = {};
    if (flags.visible !== undefined) patch.visible = flags.visible;
    if (flags.featured !== undefined) patch.featured = flags.featured;
    if (flags.markNew) patch.publishedAt = new Date();
    if (flags.visible) {
      // Solo se publican los que tienen foto y precio
      const ok = await db
        .select({ id: products.id })
        .from(products)
        .where(and(inArray(products.id, ids), sql`${products.price} > 0`, sql`exists (select 1 from product_images pi where pi.product_id = ${products.id})`));
      const allowed = ok.map((r) => r.id);
      if (allowed.length) await db.update(products).set(patch).where(inArray(products.id, allowed));
      const skipped = ids.length - allowed.length;
      catalogChanged();
      return { ok: true, message: skipped ? `${allowed.length} publicados · ${skipped} sin foto o sin precio quedaron ocultos` : `${allowed.length} publicados` };
    }
    await db.update(products).set(patch).where(inArray(products.id, ids));
    catalogChanged();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const newProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  articleCode: z.string().trim().regex(/^\d{4,6}$/, "El artículo tiene que ser un número de 5 dígitos"),
  categoryId: z.number().int().nullable(),
  price: z.number().int().positive(),
  colors: z.array(z.string().trim().min(1)).max(30),
  sizes: z.array(z.string().trim().min(1)).min(1, "Agregá al menos un talle").max(20),
});

export async function createProduct(input: z.input<typeof newProductSchema>): Promise<ActionResult & { id?: number }> {
  try {
    await requireAdmin();
    const data = newProductSchema.parse(input);
    const exists = await db.query.products.findFirst({ where: eq(products.articleCode, data.articleCode) });
    if (exists) return { ok: false, error: `Ya existe un producto con el artículo ${data.articleCode}` };
    const [created] = await db
      .insert(products)
      .values({ name: data.name, articleCode: data.articleCode, slug: `${slugify(data.name)}-${data.articleCode}`, categoryId: data.categoryId, price: data.price, visible: false })
      .returning({ id: products.id });
    await syncVariants(created.id, data.articleCode, data.colors.map((c) => c.toUpperCase()), data.sizes.map((s) => s.toUpperCase()));
    catalogChanged();
    return { ok: true, id: created.id };
  } catch (e) {
    return fail(e);
  }
}

async function ensureColorIds(names: string[]): Promise<Map<string, number>> {
  for (const name of names) await db.insert(colors).values({ name, slug: slugify(name) }).onConflictDoNothing();
  const rows = names.length ? await db.select().from(colors).where(inArray(colors.name, names)) : [];
  return new Map(rows.map((r) => [r.name, r.id]));
}

async function syncVariants(productId: number, articleCode: string, colorNames: string[], sizes: string[]) {
  const colorIds = await ensureColorIds(colorNames);
  const combos = colorNames.length ? colorNames.flatMap((c) => sizes.map((s) => ({ c: c as string | null, s }))) : sizes.map((s) => ({ c: null, s }));
  for (const { c, s } of combos) {
    const sku = c ? `${articleCode}-${c}-${s}` : `${articleCode}-${s}`;
    await db
      .insert(variants)
      .values({ productId, colorId: c ? (colorIds.get(c) ?? null) : null, size: s, sizeOrder: sizeOrder(s), sku })
      .onConflictDoUpdate({ target: variants.sku, set: { active: true, productId } });
  }
}

export async function addVariantOptions(productId: number, input: { colors: string[]; sizes: string[] }): Promise<ActionResult> {
  try {
    await requireAdmin();
    const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
    if (!product?.articleCode) return { ok: false, error: "El producto necesita número de artículo" };
    const current = await db
      .select({ size: variants.size, color: colors.name })
      .from(variants)
      .leftJoin(colors, eq(variants.colorId, colors.id))
      .where(eq(variants.productId, productId));
    const allColors = [...new Set([...current.map((v) => v.color).filter((c): c is string => Boolean(c)), ...input.colors.map((c) => c.trim().toUpperCase()).filter(Boolean)])];
    const allSizes = [...new Set([...current.map((v) => v.size), ...input.sizes.map((s) => s.trim().toUpperCase()).filter(Boolean)])];
    await syncVariants(productId, product.articleCode, allColors, allSizes);
    catalogChanged();
    return { ok: true, message: "Variantes agregadas" };
  } catch (e) {
    return fail(e);
  }
}

const variantPatchSchema = z.array(
  z.object({
    id: z.number().int(),
    stock: z.number().int().min(0).max(100000).nullable(),
    active: z.boolean(),
    priceOverride: z.number().int().positive().nullable(),
    labelCode: z
      .string()
      .trim()
      .max(40)
      .transform((v) => v || null)
      .nullable(),
  }),
);

export async function updateVariants(productId: number, patch: z.input<typeof variantPatchSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const rows = variantPatchSchema.parse(patch);
    for (const r of rows) {
      await db
        .update(variants)
        .set({ stock: r.stock, active: r.active, priceOverride: r.priceOverride, labelCode: r.labelCode })
        .where(and(eq(variants.id, r.id), eq(variants.productId, productId)));
    }
    catalogChanged();
    return { ok: true, message: "Stock guardado" };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderImages(productId: number, orderedIds: number[]): Promise<ActionResult> {
  try {
    await requireAdmin();
    for (const [i, id] of orderedIds.entries()) {
      await db.update(productImages).set({ sortOrder: i }).where(and(eq(productImages.id, id), eq(productImages.productId, productId)));
    }
    catalogChanged();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setImageColor(imageId: number, colorId: number | null): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db.update(productImages).set({ colorId }).where(eq(productImages.id, imageId));
    catalogChanged();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteImage(imageId: number): Promise<ActionResult> {
  try {
    await requireAdmin();
    const [img] = await db.delete(productImages).where(eq(productImages.id, imageId)).returning();
    if (img) {
      const others = img.url.match(/-w\d+\.webp$/) ? [400, 800, 1200].map((w) => img.url.replace(/-w\d+\.webp$/, `-w${w}.webp`)).concat(img.url.replace(/-w\d+\.webp$/, "-share.jpg")) : [img.url];
      await deleteFiles(others).catch((e) => console.error("[admin] no se pudo borrar del storage", e));
      // Si se quedó sin fotos, se oculta
      const left = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, img.productId)).limit(1);
      if (left.length === 0) await db.update(products).set({ visible: false }).where(eq(products.id, img.productId));
    }
    catalogChanged();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- precios

export async function updatePrices(changes: { id: number; price: number }[]): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = z.array(z.object({ id: z.number().int(), price: z.number().int().min(1).max(100_000_000) })).parse(changes);
    for (const c of parsed) await db.update(products).set({ price: c.price }).where(eq(products.id, c.id));
    catalogChanged();
    return { ok: true, message: `${parsed.length} precios actualizados` };
  } catch (e) {
    return fail(e);
  }
}

const bulkSchema = z.object({
  percent: z.number().min(-90).max(500),
  scope: z.enum(["todos", "categoria", "seleccion"]),
  categoryId: z.number().int().nullable(),
  productIds: z.array(z.number().int()),
  rounding: z.enum(["ninguno", "100", "1000"]),
});

export async function applyBulkIncrease(input: z.input<typeof bulkSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = bulkSchema.parse(input);
    if (data.percent === 0) return { ok: false, error: "Indicá un porcentaje distinto de 0" };
    const where =
      data.scope === "todos"
        ? undefined
        : data.scope === "categoria"
          ? data.categoryId
            ? eq(products.categoryId, data.categoryId)
            : sql`${products.categoryId} is null`
          : data.productIds.length
            ? inArray(products.id, data.productIds)
            : sql`false`;
    const rows = await db.select({ id: products.id, price: products.price }).from(products).where(where);
    let changed = 0;
    await db.transaction(async (tx) => {
      for (const r of rows) {
        const next = roundPrice(r.price * (1 + data.percent / 100), data.rounding as Rounding);
        if (next !== r.price && next > 0) {
          await tx.update(products).set({ price: next }).where(eq(products.id, r.id));
          changed++;
        }
      }
      // Los precios propios de variantes también se ajustan
      const productIds = rows.map((r) => r.id);
      if (productIds.length) {
        const vs = await tx
          .select({ id: variants.id, price: variants.priceOverride })
          .from(variants)
          .where(and(inArray(variants.productId, productIds), sql`${variants.priceOverride} is not null`));
        for (const v of vs) {
          await tx
            .update(variants)
            .set({ priceOverride: roundPrice((v.price ?? 0) * (1 + data.percent / 100), data.rounding as Rounding) })
            .where(eq(variants.id, v.id));
        }
      }
    });
    catalogChanged();
    return { ok: true, message: `${changed} precios actualizados` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- CSV

const csvRowSchema = z.object({
  articulo: z.string().trim().optional().default(""),
  sku: z.string().trim().optional().default(""),
  nombre: z.string().trim().optional().default(""),
  precio: z.string().trim().optional().default(""),
  stock: z.string().trim().optional().default(""),
  visible: z.string().trim().optional().default(""),
  etiqueta: z.string().trim().optional().default(""),
});

export type CsvChange = { kind: "precio" | "nombre" | "stock" | "visible" | "etiqueta"; key: string; label: string; from: string; to: string };

function parseNumber(v: string): number | null {
  const clean = v.replace(/[$\s.]/g, "").replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseBool(v: string): boolean | null {
  const s = v.trim().toLowerCase();
  if (["si", "sí", "1", "true", "visible", "x"].includes(s)) return true;
  if (["no", "0", "false", "oculto"].includes(s)) return false;
  return null;
}

async function computeCsvChanges(raw: Record<string, string>[]) {
  const rows = raw.map((r) => csvRowSchema.parse(Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), String(v ?? "")]))));
  const allProducts = await db
    .select({
      id: products.id,
      articleCode: products.articleCode,
      name: products.name,
      price: products.price,
      visible: products.visible,
      hasImage: sql<boolean>`exists (select 1 from product_images pi where pi.product_id = ${products.id})`,
    })
    .from(products);
  const byArticle = new Map(allProducts.filter((p) => p.articleCode).map((p) => [p.articleCode!, p]));
  const allVariants = await db.select({ id: variants.id, sku: variants.sku, stock: variants.stock, labelCode: variants.labelCode }).from(variants);
  const bySku = new Map(allVariants.map((v) => [v.sku.toUpperCase(), v]));

  const changes: CsvChange[] = [];
  const productPatch = new Map<number, Partial<typeof products.$inferInsert>>();
  const variantPatch = new Map<number, Partial<typeof variants.$inferInsert>>();
  const unknown: string[] = [];
  for (const r of rows) {
    const product = r.articulo ? byArticle.get(r.articulo) : undefined;
    if (r.articulo && !product) unknown.push(`Artículo ${r.articulo}`);
    if (product) {
      // El CSV trae una fila por variante: se toma el primer valor distinto al actual
      const patch = productPatch.get(product.id) ?? {};
      const price = parseNumber(r.precio);
      if (patch.price === undefined && price !== null && price > 0 && price !== product.price) {
        patch.price = price;
        changes.push({ kind: "precio", key: product.articleCode!, label: product.name, from: String(product.price), to: String(price) });
      }
      if (patch.name === undefined && r.nombre && r.nombre !== product.name) {
        patch.name = r.nombre;
        changes.push({ kind: "nombre", key: product.articleCode!, label: product.name, from: product.name, to: r.nombre });
      }
      const visible = parseBool(r.visible);
      if (patch.visible === undefined && visible === true && !product.visible && !product.hasImage) {
        unknown.push(`Artículo ${product.articleCode}: no tiene fotos, sigue oculto`);
      } else if (patch.visible === undefined && visible !== null && visible !== product.visible) {
        patch.visible = visible;
        changes.push({ kind: "visible", key: product.articleCode!, label: product.name, from: product.visible ? "sí" : "no", to: visible ? "sí" : "no" });
      }
      if (Object.keys(patch).length) productPatch.set(product.id, patch);
    }
    if (r.sku) {
      const v = bySku.get(r.sku.toUpperCase());
      if (!v) {
        unknown.push(`SKU ${r.sku}`);
        continue;
      }
      const patch: Partial<typeof variants.$inferInsert> = {};
      if (r.stock !== "") {
        const stock = r.stock.trim() === "-" ? null : parseNumber(r.stock);
        if (stock !== v.stock && (stock === null || stock >= 0)) {
          patch.stock = stock;
          changes.push({ kind: "stock", key: v.sku, label: v.sku, from: v.stock === null ? "sin control" : String(v.stock), to: stock === null ? "sin control" : String(stock) });
        }
      }
      if (r.etiqueta && r.etiqueta !== v.labelCode) {
        patch.labelCode = r.etiqueta;
        changes.push({ kind: "etiqueta", key: v.sku, label: v.sku, from: v.labelCode ?? "", to: r.etiqueta });
      }
      if (Object.keys(patch).length) variantPatch.set(v.id, patch);
    }
  }
  return { changes, productPatch, variantPatch, unknown: [...new Set(unknown)] };
}

export async function previewCsvImport(raw: Record<string, string>[]): Promise<{ ok: true; changes: CsvChange[]; unknown: string[] } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    if (raw.length > 10000) return { ok: false, error: "El archivo tiene demasiadas filas (máximo 10.000)" };
    const { changes, unknown } = await computeCsvChanges(raw);
    return { ok: true, changes, unknown };
  } catch (e) {
    const r = fail(e);
    return r.ok ? { ok: false, error: "Error" } : r;
  }
}

export async function applyCsvImport(raw: Record<string, string>[]): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { productPatch, variantPatch, changes } = await computeCsvChanges(raw);
    await db.transaction(async (tx) => {
      for (const [id, patch] of productPatch) await tx.update(products).set(patch).where(eq(products.id, id));
      for (const [id, patch] of variantPatch) await tx.update(variants).set(patch).where(eq(variants.id, id));
    });
    catalogChanged();
    return { ok: true, message: `${changes.length} cambios aplicados` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- categorías

export async function updateCategory(id: number, input: { name: string; visible: boolean; featured: boolean; sortOrder: number; sizeGuide: string; imageUrl: string | null }): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = z
      .object({
        name: z.string().trim().min(2).max(60),
        visible: z.boolean(),
        featured: z.boolean(),
        sortOrder: z.number().int(),
        sizeGuide: z.enum(["letras", "jeans", "unico"]),
        imageUrl: z.string().url().or(z.string().startsWith("/")).nullable(),
      })
      .parse(input);
    await db.update(categories).set(data).where(eq(categories.id, id));
    catalogChanged();
    return { ok: true, message: "Categoría guardada" };
  } catch (e) {
    return fail(e);
  }
}

export async function createCategory(name: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const clean = z.string().trim().min(2).max(60).parse(name);
    await db.insert(categories).values({ name: clean, slug: slugify(clean), sortOrder: 50 }).onConflictDoNothing();
    catalogChanged();
    return { ok: true, message: "Categoría creada" };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- configuración

export async function saveSettings(key: "site" | "pages" | "look", value: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
    const json = z.record(z.string(), z.unknown()).parse(value);
    if (JSON.stringify(json).length > 200_000) return { ok: false, error: "Contenido demasiado largo" };
    await db.insert(settings).values({ key, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } });
    updateTag(TAGS.settings);
    if (key === "look") updateTag(TAGS.catalog);
    return { ok: true, message: "Guardado" };
  } catch (e) {
    return fail(e);
  }
}
