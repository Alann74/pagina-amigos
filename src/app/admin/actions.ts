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
    // Ordenadas a mano: el deploy no las vuelve a ordenar solo
    const { markManualOrder } = await import("@/lib/photo-order");
    await markManualOrder(productId);
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

// ---------------------------------------------------------------- mayoristas

const wholesaleSchema = z.object({
  enabled: z.boolean(),
  code: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  minAmount: z.number().int().min(0).max(100_000_000),
  minUnits: z.number().int().min(0).max(10_000),
  cashDiscountPercent: z.number().int().min(0).max(90),
  note: z.string().trim().max(400),
});

export async function saveWholesaleSettings(input: z.input<typeof wholesaleSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const value = wholesaleSchema.parse(input);
    if (value.enabled && value.code.length < 4) return { ok: false, error: "El código tiene que tener al menos 4 caracteres" };
    await db.insert(settings).values({ key: "wholesale", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
    return { ok: true, message: value.enabled ? "Acceso mayorista activo" : "Guardado (acceso desactivado)" };
  } catch (e) {
    return fail(e);
  }
}

export async function saveWholesalePrices(changes: { id: number; wholesalePrice: number | null }[]): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = z.array(z.object({ id: z.number().int(), wholesalePrice: z.number().int().min(1).max(100_000_000).nullable() })).max(2000).parse(changes);
    for (const c of parsed) await db.update(products).set({ wholesalePrice: c.wholesalePrice }).where(eq(products.id, c.id));
    // Los precios por mayor no se guardan en caché (se piden en vivo con el acceso), no hace falta refrescar la tienda
    return { ok: true, message: `${parsed.length} precios por mayor guardados` };
  } catch (e) {
    return fail(e);
  }
}

/** Baja una planilla de Google Sheets como CSV (tiene que estar compartida con "cualquiera con el enlace"). */
export async function fetchSheetCsv(link: string): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const id = link.match(/\/spreadsheets\/d\/([\w-]{20,})/)?.[1];
    if (!id) return { ok: false, error: "Pegá el link de la planilla de Google Sheets" };
    const gid = link.match(/[#&?]gid=(\d+)/)?.[1];
    const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
    const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(20_000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || type.includes("text/html")) {
      return { ok: false, error: "No se pudo leer la planilla. En Google Sheets: Compartir → Cualquier persona con el enlace (lector), o descargala como Excel y subila." };
    }
    const csv = await res.text();
    if (csv.length > 2_000_000) return { ok: false, error: "La planilla es demasiado grande" };
    return { ok: true, csv };
  } catch (e) {
    const r = fail(e);
    return r.ok ? { ok: false, error: "Error" } : r;
  }
}

// ---------------------------------------------------------------- mantenimiento

/** Vuelve a armar ya mismo todas las páginas de la tienda (fotos, precios, textos). */
export async function refreshStore(): Promise<ActionResult> {
  try {
    await requireAdmin();
    updateTag(TAGS.catalog);
    updateTag(TAGS.settings);
    updateTag(TAGS.bestsellers);
    return { ok: true, message: "Tienda actualizada: los cambios ya se ven en todos los dispositivos" };
  } catch (e) {
    return fail(e);
  }
}

/** Revisa desde el servidor que existan todas las fotos del catálogo (los 3 tamaños WebP y el JPG). */
export async function runPhotoCheck(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { checkAllProductPhotos } = await import("@/lib/photo-check");
    const r = await checkAllProductPhotos();
    return r.rotas.length
      ? { ok: false, error: `${r.rotas.length} archivos de fotos con problemas (de ${r.archivos}). Detalle abajo.` }
      : { ok: true, message: `Todo bien: ${r.fotos} fotos de ${r.productosPublicados} productos, ${r.archivos} archivos revisados${r.productosSinFoto.length ? ` · ${r.productosSinFoto.length} productos sin foto` : ""}` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- productos nuevos desde la lista de precios

const newProductRowSchema = z.object({
  code: z.string().regex(/^\d{5}$/),
  name: z.string().trim().min(2).max(120),
  price: z.number().int().min(1).max(100_000_000),
  category: z.string().trim().max(60).nullable(),
  colors: z.array(z.string().trim().min(1).max(40)).max(30),
  sizes: z.array(z.string().trim().min(1).max(10)).min(1).max(20),
});

export type NewProductsPreview = {
  nuevos: { code: string; name: string; price: number; category: string | null; colors: string[]; sizes: string[] }[];
  precios: { id: number; code: string; name: string; from: number; to: number }[];
  iguales: number;
};

export async function previewNewProducts(input: z.input<typeof newProductRowSchema>[]): Promise<{ ok: true; preview: NewProductsPreview } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const rows = z.array(newProductRowSchema).max(2000).parse(input);
    const { prettyProductName } = await import("@/lib/product-import");
    const existing = await db.select({ id: products.id, code: products.articleCode, name: products.name, price: products.price }).from(products);
    const byCode = new Map(existing.filter((p) => p.code).map((p) => [p.code!, p]));
    const preview: NewProductsPreview = { nuevos: [], precios: [], iguales: 0 };
    const seen = new Set<string>();
    for (const r of rows) {
      if (seen.has(r.code)) continue;
      seen.add(r.code);
      const p = byCode.get(r.code);
      if (!p) preview.nuevos.push({ ...r, name: prettyProductName(r.name) });
      else if (p.price !== r.price) preview.precios.push({ id: p.id, code: r.code, name: p.name, from: p.price, to: r.price });
      else preview.iguales++;
    }
    return { ok: true, preview };
  } catch (e) {
    const r = fail(e);
    return r.ok ? { ok: false, error: "Error" } : r;
  }
}

export async function applyNewProducts(input: { nuevos: NewProductsPreview["nuevos"]; precios: { id: number; to: number }[] }): Promise<ActionResult> {
  try {
    await requireAdmin();
    const nuevos = z.array(newProductRowSchema).max(2000).parse(input.nuevos);
    const precios = z.array(z.object({ id: z.number().int(), to: z.number().int().min(1).max(100_000_000) })).max(2000).parse(input.precios);
    const { defaultSizes } = await import("@/lib/product-import");
    let created = 0;
    for (const r of nuevos) {
      // Categoría (se crea si no existe) y colores
      let categoryId: number | null = null;
      if (r.category) {
        await db.insert(categories).values({ slug: slugify(r.category), name: r.category, sizeGuide: r.category === "Jeans" ? "jeans" : ["Carteras", "Accesorios"].includes(r.category) ? "unico" : "letras" }).onConflictDoNothing();
        categoryId = (await db.query.categories.findFirst({ where: eq(categories.slug, slugify(r.category)) }))?.id ?? null;
      }
      if (r.colors.length) await db.insert(colors).values(r.colors.map((c) => ({ name: c, slug: slugify(c) }))).onConflictDoNothing();
      const colorRows = r.colors.length ? await db.select({ id: colors.id, name: colors.name }).from(colors).where(inArray(colors.name, r.colors)) : [];
      const [p] = await db
        .insert(products)
        .values({ slug: `${slugify(r.name)}-${r.code}`, articleCode: r.code, name: r.name, price: r.price, categoryId, visible: false, publishedAt: new Date() })
        .onConflictDoNothing()
        .returning({ id: products.id });
      if (!p) continue;
      const sizes = r.sizes.length ? r.sizes : defaultSizes(r.category);
      const combos = colorRows.length ? colorRows.flatMap((c) => sizes.map((s) => ({ c, s }))) : sizes.map((s) => ({ c: null, s }));
      await db
        .insert(variants)
        .values(combos.map(({ c, s }) => ({ productId: p.id, colorId: c?.id ?? null, size: s, sizeOrder: sizeOrder(s), sku: c ? `${r.code}-${c.name}-${s}` : `${r.code}-${s}`, stock: null, active: true })))
        .onConflictDoNothing();
      created++;
    }
    for (const c of precios) await db.update(products).set({ price: c.to }).where(eq(products.id, c.id));
    if (created || precios.length) catalogChanged();
    return { ok: true, message: `${created} productos nuevos (quedan ocultos hasta tener foto)${precios.length ? ` · ${precios.length} precios actualizados` : ""}` };
  } catch (e) {
    return fail(e);
  }
}

/** Busca fotos nuevas en las carpetas de Drive de Temporada 3 (por el número de artículo del nombre). */
export async function searchDrivePhotos(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { discoverDrivePhotos } = await import("@/lib/drive-discovery");
    const r = await discoverDrivePhotos();
    const errores = r.carpetas.filter((c) => c.error);
    if (errores.length === r.carpetas.length) return { ok: false, error: `No se pudo leer Drive: ${errores[0]?.error ?? "error"}. Revisá que las carpetas sigan compartidas con "cualquiera con el enlace".` };
    return { ok: true, message: `Drive: ${r.fotos} fotos para ${r.articulos} artículos. Ahora tocá “Importar fotos pendientes”.` };
  } catch (e) {
    return fail(e);
  }
}
