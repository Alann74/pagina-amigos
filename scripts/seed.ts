// Carga categorías, colores, productos y variantes desde data/pos-productos.csv (export del POS).
// Es idempotente: actualiza por código de artículo / SKU sin duplicar.   npm run db:seed
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { slugify, sizeOrder } from "../src/lib/format";

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

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const pool = new Pool({ connectionString: url, max: 2 });
  const db = drizzle(pool, { schema });

  const csvPath = path.join(process.cwd(), "data/pos-productos.csv");
  const parsed = Papa.parse<Row>(fs.readFileSync(csvPath, "utf8"), { header: true, skipEmptyLines: true });
  const rows = parsed.data.filter((r) => !/producto prueba/i.test(r.nombre));

  // Fotos disponibles por artículo (para ocultar productos sin foto)
  const matchesPath = path.join(process.cwd(), "data/photo-matches.json");
  const withPhotos = fs.existsSync(matchesPath) ? new Set(Object.keys(JSON.parse(fs.readFileSync(matchesPath, "utf8")))) : null;

  // Categorías
  const catNames = [...new Set(rows.map((r) => r.categoria))];
  for (const name of catNames) {
    const order = CATEGORY_ORDER.indexOf(name);
    await db
      .insert(schema.categories)
      .values({
        slug: slugify(name),
        name,
        sortOrder: order === -1 ? 99 : order,
        featured: FEATURED.includes(name),
        sizeGuide: SIZE_GUIDE[name] ?? "letras",
      })
      .onConflictDoUpdate({ target: schema.categories.slug, set: { name, sizeGuide: SIZE_GUIDE[name] ?? "letras" } });
  }
  const cats = new Map((await db.select().from(schema.categories)).map((c) => [c.name, c.id]));

  // Colores
  const colorNames = [...new Set(rows.flatMap((r) => r.colores.split("|").filter(Boolean)))];
  for (const name of colorNames) {
    await db.insert(schema.colors).values({ name, slug: slugify(name) }).onConflictDoNothing();
  }
  const colorIds = new Map((await db.select().from(schema.colors)).map((c) => [c.name, c.id]));

  let created = 0;
  let updated = 0;
  let hidden = 0;
  let variantCount = 0;
  const now = Date.now();

  for (const [index, r] of rows.entries()) {
    const name = prettyName(r.nombre);
    const article = r.articulo.trim() || null;
    const price = Number(r.precio);
    const hasPhoto = article ? (withPhotos ? withPhotos.has(article) : true) : false;
    const visible = Boolean(article) && price > 0 && hasPhoto;
    if (!visible) hidden++;
    const slug = article ? `${slugify(name)}-${article}` : `${slugify(name)}-pos${r.pos_id}`;
    const values = {
      slug,
      articleCode: article,
      name,
      categoryId: cats.get(r.categoria) ?? null,
      price,
      visible,
      posProductId: Number(r.pos_id),
      sortOrder: 0,
      // El POS no tiene fecha de ingreso: arrancan "publicados hace 20 días" para que no salga NUEVO en todo
      // el catálogo el día del lanzamiento. Desde el admin se marcan los nuevos ingresos.
      publishedAt: new Date(now - 20 * 24 * 60 * 60 * 1000 - index * 60_000),
    };
    const existing = await db.query.products.findFirst({ where: eq(schema.products.posProductId, values.posProductId) });
    let productId: number;
    if (existing) {
      const { publishedAt: _keep, ...rest } = values;
      await db.update(schema.products).set({ ...rest, visible: existing.visible && visible ? existing.visible : visible }).where(eq(schema.products.id, existing.id));
      productId = existing.id;
      updated++;
    } else {
      const [inserted] = await db.insert(schema.products).values(values).returning({ id: schema.products.id });
      productId = inserted.id;
      created++;
    }

    const colorsList = r.colores.split("|").filter(Boolean);
    const sizes = r.talles.split("|").filter(Boolean);
    const combos = colorsList.length ? colorsList.flatMap((c) => sizes.map((s) => ({ color: c as string | null, size: s }))) : sizes.map((s) => ({ color: null, size: s }));
    for (const combo of combos) {
      const skuBase = article ?? `SINART${r.pos_id}`;
      const sku = combo.color ? `${skuBase}-${combo.color}-${combo.size}` : `${skuBase}-${combo.size}`;
      await db
        .insert(schema.variants)
        .values({
          productId,
          colorId: combo.color ? colorIds.get(combo.color) ?? null : null,
          size: combo.size,
          sizeOrder: sizeOrder(combo.size),
          sku,
          stock: null,
          active: true,
        })
        .onConflictDoUpdate({ target: schema.variants.sku, set: { productId, size: combo.size, sizeOrder: sizeOrder(combo.size) } });
      variantCount++;
    }
  }

  // Configuración por defecto (no pisa lo que ya se haya editado en el admin)
  await db.execute(sql`insert into settings (key, value) values ('site', '{}'::jsonb) on conflict (key) do nothing`);

  console.log({ productos: rows.length, creados: created, actualizados: updated, ocultos: hidden, variantes: variantCount, categorias: catNames.length, colores: colorNames.length });
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
