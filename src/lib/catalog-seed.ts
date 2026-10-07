import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import Papa from "papaparse";
import * as schema from "@/db/schema";
import { slugify, sizeOrder } from "@/lib/format";

// Carga inicial del catálogo desde el export del POS (data/pos-productos.csv).
// Inserta en lote (pocas idas a la base) y NUNCA pisa lo que ya existe: si se vuelve a correr,
// solo agrega lo que falte. Así no se pierden precios ni cambios hechos desde el admin.

type DB = NodePgDatabase<typeof schema>;

const CATEGORY_ORDER = [
  "Blusas", "Remeras", "Musculosas", "Tops", "Bodies", "Camisas", "Vestidos", "Monos", "Jeans", "Pantalones",
  "Shorts", "Bermudas", "Polleras", "Sweaters", "Buzos", "Blazers", "Camperas", "Pilotos", "Chalecos", "Carteras", "Accesorios",
];
const FEATURED = ["Vestidos", "Jeans", "Remeras", "Blazers", "Pantalones", "Carteras"];
const SIZE_GUIDE: Record<string, string> = { Jeans: "jeans", Carteras: "unico", Accesorios: "unico" };

type Row = { pos_id: string; articulo: string; nombre: string; categoria: string; precio: string; colores: string; talles: string; nota: string };

function prettyName(name: string): string {
  return name.replace(/^Pantalon\b/, "Pantalón").replace(/\s+/g, " ").trim();
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export type SeedSummary = { productos: number; nuevos: number; ocultos: number; variantes: number; categorias: number; colores: number };

export async function seedCatalog(db: DB, csvText: string, articlesWithPhotos: Set<string> | null): Promise<SeedSummary> {
  const parsed = Papa.parse<Row>(csvText, { header: true, skipEmptyLines: true });
  const rows = parsed.data.filter((r) => r.nombre && !/producto prueba/i.test(r.nombre));

  // Categorías
  const catNames = [...new Set(rows.map((r) => r.categoria).filter(Boolean))];
  if (catNames.length) {
    await db
      .insert(schema.categories)
      .values(
        catNames.map((name) => {
          const order = CATEGORY_ORDER.indexOf(name);
          return { slug: slugify(name), name, sortOrder: order === -1 ? 99 : order, featured: FEATURED.includes(name), sizeGuide: SIZE_GUIDE[name] ?? "letras" };
        }),
      )
      .onConflictDoNothing();
  }
  const cats = new Map((await db.select({ id: schema.categories.id, name: schema.categories.name }).from(schema.categories)).map((c) => [c.name, c.id]));

  // Colores
  const colorNames = [...new Set(rows.flatMap((r) => r.colores.split("|").filter(Boolean)))];
  if (colorNames.length) await db.insert(schema.colors).values(colorNames.map((name) => ({ name, slug: slugify(name) }))).onConflictDoNothing();
  const colorIds = new Map((await db.select({ id: schema.colors.id, name: schema.colors.name }).from(schema.colors)).map((c) => [c.name, c.id]));

  // Productos: visibles solo con artículo, precio y foto en Drive
  const now = Date.now();
  let hidden = 0;
  const productValues = rows.map((r, index) => {
    const name = prettyName(r.nombre);
    const article = r.articulo.trim() || null;
    const price = Number(r.precio) || 0;
    const hasPhoto = article ? (articlesWithPhotos ? articlesWithPhotos.has(article) : true) : false;
    const visible = Boolean(article) && price > 0 && hasPhoto;
    if (!visible) hidden++;
    return {
      slug: article ? `${slugify(name)}-${article}` : `${slugify(name)}-pos${r.pos_id}`,
      articleCode: article,
      name,
      categoryId: cats.get(r.categoria) ?? null,
      price,
      visible,
      posProductId: Number(r.pos_id),
      // El POS no tiene fecha de ingreso: arrancan "publicados hace 20 días" para que no salga NUEVO en todo el
      // catálogo el día del lanzamiento. Desde el admin se marcan los nuevos ingresos.
      publishedAt: new Date(now - 20 * 24 * 60 * 60 * 1000 - index * 60_000),
    };
  });
  let inserted = 0;
  for (const part of chunk(productValues, 200)) {
    const res = await db.insert(schema.products).values(part).onConflictDoNothing().returning({ id: schema.products.id });
    inserted += res.length;
  }
  const productIds = new Map(
    (await db.select({ id: schema.products.id, posProductId: schema.products.posProductId }).from(schema.products)).filter((p) => p.posProductId !== null).map((p) => [p.posProductId!, p.id]),
  );

  // Variantes (SKU con el formato del POS: ARTICULO-COLOR-TALLE)
  const variantValues: (typeof schema.variants.$inferInsert)[] = [];
  const seenSku = new Set<string>();
  for (const r of rows) {
    const productId = productIds.get(Number(r.pos_id));
    if (!productId) continue;
    const article = r.articulo.trim() || `SINART${r.pos_id}`;
    const colorsList = r.colores.split("|").filter(Boolean);
    const sizes = r.talles.split("|").filter(Boolean);
    const combos = colorsList.length ? colorsList.flatMap((c) => sizes.map((s) => ({ color: c as string | null, size: s }))) : sizes.map((s) => ({ color: null, size: s }));
    for (const combo of combos) {
      const sku = combo.color ? `${article}-${combo.color}-${combo.size}` : `${article}-${combo.size}`;
      if (seenSku.has(sku)) continue;
      seenSku.add(sku);
      variantValues.push({ productId, colorId: combo.color ? (colorIds.get(combo.color) ?? null) : null, size: combo.size, sizeOrder: sizeOrder(combo.size), sku, stock: null, active: true });
    }
  }
  for (const part of chunk(variantValues, 500)) await db.insert(schema.variants).values(part).onConflictDoNothing();

  // Configuración por defecto (no pisa lo que ya se haya editado en el admin)
  await db.execute(sql`insert into settings (key, value) values ('site', '{}'::jsonb) on conflict (key) do nothing`);

  return { productos: rows.length, nuevos: inserted, ocultos: hidden, variantes: variantValues.length, categorias: catNames.length, colores: colorNames.length };
}
