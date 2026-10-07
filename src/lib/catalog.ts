import { cacheLife, cacheTag } from "next/cache";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, colors, orderItems, orders, productImages, products, settings, variants } from "@/db/schema";
import {
  DEFAULT_LOOK,
  DEFAULT_PAGES,
  DEFAULT_SETTINGS,
  type LookSettings,
  type PagesContent,
  type SiteSettings,
} from "./site-config";

export const TAGS = {
  catalog: "catalog",
  settings: "settings",
  bestsellers: "bestsellers",
} as const;

export type CatalogImage = { url: string; alt: string; color: string | null; width: number | null; height: number | null };

export type CatalogVariant = {
  id: number;
  size: string;
  color: string | null;
  sku: string;
  stock: number | null;
  price: number;
  available: boolean;
};

export type CatalogProduct = {
  id: number;
  slug: string;
  name: string;
  articleCode: string | null;
  description: string;
  price: number;
  compareAtPrice: number | null;
  categorySlug: string | null;
  categoryName: string | null;
  sizeGuide: string;
  featured: boolean;
  publishedAt: string;
  images: CatalogImage[];
  sizes: string[];
  colors: string[];
  variants: CatalogVariant[];
  badge: "nuevo" | "ultimas" | "sin-stock" | null;
  soldOut: boolean;
  sortOrder: number;
};

export type CatalogCategory = {
  id: number;
  slug: string;
  name: string;
  featured: boolean;
  imageUrl: string | null;
  productCount: number;
};

function deepMerge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const current = out[k];
    if (current && typeof current === "object" && !Array.isArray(current) && v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(current, v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
    return row ? deepMerge(fallback, row.value) : fallback;
  } catch (error) {
    console.error(`[settings] no se pudo leer "${key}"`, error);
    return fallback;
  }
}

export async function getSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.settings);
  return readSetting("site", DEFAULT_SETTINGS);
}

export async function getPages(): Promise<PagesContent> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.settings);
  return readSetting("pages", DEFAULT_PAGES);
}

export async function getLookSettings(): Promise<LookSettings> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.settings);
  return readSetting("look", DEFAULT_LOOK);
}

export async function getCategories(): Promise<CatalogCategory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      featured: categories.featured,
      imageUrl: categories.imageUrl,
      productCount: sql<number>`count(${products.id}) filter (where ${products.visible})`.mapWith(Number),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(eq(categories.visible, true))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows;
}

/**
 * Catálogo completo visible. Son pocos cientos de productos: se cachea entero y
 * los listados filtran en memoria (más rápido que ir a la base en cada página).
 */
export async function getCatalog(): Promise<CatalogProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);

  const config = await getSettings();
  const [productRows, imageRows, variantRows] = await Promise.all([
    db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        articleCode: products.articleCode,
        description: products.description,
        price: products.price,
        compareAtPrice: products.compareAtPrice,
        featured: products.featured,
        publishedAt: products.publishedAt,
        sortOrder: products.sortOrder,
        categorySlug: categories.slug,
        categoryName: categories.name,
        sizeGuide: categories.sizeGuide,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.visible, true), sql`(${categories.id} is null or ${categories.visible})`)),
    db
      .select({
        productId: productImages.productId,
        url: productImages.url,
        alt: productImages.alt,
        width: productImages.width,
        height: productImages.height,
        color: colors.name,
        sortOrder: productImages.sortOrder,
      })
      .from(productImages)
      .leftJoin(colors, eq(productImages.colorId, colors.id))
      .orderBy(asc(productImages.productId), asc(productImages.sortOrder), asc(productImages.id)),
    db
      .select({
        id: variants.id,
        productId: variants.productId,
        size: variants.size,
        sizeOrder: variants.sizeOrder,
        sku: variants.sku,
        stock: variants.stock,
        priceOverride: variants.priceOverride,
        color: colors.name,
      })
      .from(variants)
      .leftJoin(colors, eq(variants.colorId, colors.id))
      .where(eq(variants.active, true))
      .orderBy(asc(variants.productId), asc(variants.sizeOrder), asc(colors.name)),
  ]);

  const imagesByProduct = new Map<number, CatalogImage[]>();
  for (const img of imageRows) {
    const list = imagesByProduct.get(img.productId) ?? [];
    list.push({ url: img.url, alt: img.alt, color: img.color, width: img.width, height: img.height });
    imagesByProduct.set(img.productId, list);
  }
  const variantsByProduct = new Map<number, (typeof variantRows)[number][]>();
  for (const v of variantRows) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push(v);
    variantsByProduct.set(v.productId, list);
  }

  const now = Date.now();
  const newMs = config.newProductDays * 24 * 60 * 60 * 1000;

  return productRows
    .map((p): CatalogProduct => {
      const vs = (variantsByProduct.get(p.id) ?? []).map(
        (v): CatalogVariant => ({
          id: v.id,
          size: v.size,
          color: v.color,
          sku: v.sku,
          stock: v.stock,
          price: v.priceOverride ?? p.price,
          available: v.stock === null || v.stock > 0,
        }),
      );
      const sizes = [...new Set(vs.map((v) => v.size))];
      const colorList = [...new Set(vs.map((v) => v.color).filter((c): c is string => Boolean(c)))];
      const soldOut = vs.length > 0 && vs.every((v) => !v.available);
      const allKnown = vs.length > 0 && vs.every((v) => v.stock !== null);
      const totalStock = allKnown ? vs.reduce((acc, v) => acc + (v.stock ?? 0), 0) : null;
      const isNew = now - new Date(p.publishedAt).getTime() < newMs;
      let badge: CatalogProduct["badge"] = null;
      if (soldOut) badge = "sin-stock";
      else if (totalStock !== null && totalStock <= config.lowStockThreshold) badge = "ultimas";
      else if (isNew) badge = "nuevo";
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        articleCode: p.articleCode,
        description: p.description,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        categorySlug: p.categorySlug,
        categoryName: p.categoryName,
        sizeGuide: p.sizeGuide ?? "letras",
        featured: p.featured,
        publishedAt: new Date(p.publishedAt).toISOString(),
        images: imagesByProduct.get(p.id) ?? [],
        sizes,
        colors: colorList,
        variants: vs,
        badge,
        soldOut,
        sortOrder: p.sortOrder,
      };
    })
    .sort(
      (a, b) =>
        Number(a.soldOut) - Number(b.soldOut) ||
        a.sortOrder - b.sortOrder ||
        b.publishedAt.localeCompare(a.publishedAt) ||
        a.id - b.id,
    );
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const catalog = await getCatalog();
  return catalog.find((p) => p.slug === slug) ?? null;
}

export async function getCategoryBySlug(slug: string): Promise<CatalogCategory | null> {
  const all = await getCategories();
  return all.find((c) => c.slug === slug) ?? null;
}

/** "Lo más pedido": productos con más unidades en pedidos no cancelados de los últimos 90 días. */
export async function getBestSellerIds(limit = 8): Promise<number[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.bestsellers);
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ productId: orderItems.productId, units: sql<number>`sum(${orderItems.quantity})`.mapWith(Number) })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(gte(orders.createdAt, since), sql`${orders.status} <> 'cancelado'`, sql`${orderItems.productId} is not null`))
      .groupBy(orderItems.productId)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(limit);
    return rows.map((r) => r.productId as number);
  } catch (error) {
    console.error("[bestsellers]", error);
    return [];
  }
}

export async function getProductsByIds(ids: number[]): Promise<CatalogProduct[]> {
  if (ids.length === 0) return [];
  const catalog = await getCatalog();
  const byId = new Map(catalog.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is CatalogProduct => Boolean(p));
}

export async function getAllProductSlugs(): Promise<string[]> {
  const catalog = await getCatalog();
  return catalog.map((p) => p.slug);
}
