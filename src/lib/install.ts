import fs from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@/db";
import { seedCatalog } from "@/lib/catalog-seed";
import { PHOTO_MATCHES } from "@/lib/drive-import";
import { SITE_URL } from "@/lib/site";
import journal from "../../drizzle/meta/_journal.json";

// Estado y preparación de la base desde /admin/instalacion (sin consola ni scripts).

export type InstallStatus = {
  env: { database: boolean; blob: boolean; sessionSecret: boolean; siteUrl: string; metaPixel: boolean; ga4: boolean };
  connection: { ok: boolean; error: string | null };
  migrations: { total: number; applied: number };
  counts: { products: number; visible: number; variants: number; images: number; orders: number } | null;
};

export async function getInstallStatus(): Promise<InstallStatus> {
  const env = {
    database: Boolean(process.env.DATABASE_URL),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    sessionSecret: Boolean(process.env.ADMIN_SESSION_SECRET),
    siteUrl: SITE_URL,
    metaPixel: Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID),
    ga4: Boolean(process.env.NEXT_PUBLIC_GA4_ID),
  };
  const total = journal.entries.length;
  if (!env.database) return { env, connection: { ok: false, error: "Falta DATABASE_URL" }, migrations: { total, applied: 0 }, counts: null };
  try {
    const applied = await db
      .execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)
      .then((r) => Number((r.rows[0] as { n: number }).n))
      .catch(() => 0);
    const ready = await db.execute(sql`select to_regclass('public.products') is not null as ready`).then((r) => Boolean((r.rows[0] as { ready: boolean }).ready));
    let counts: InstallStatus["counts"] = null;
    if (ready) {
      const r = await db.execute(sql`select
        (select count(*) from products)::int as products,
        (select count(*) from products where visible)::int as visible,
        (select count(*) from variants)::int as variants,
        (select count(*) from product_images)::int as images,
        (select count(*) from orders)::int as orders`);
      counts = r.rows[0] as InstallStatus["counts"];
    }
    return { env, connection: { ok: true, error: null }, migrations: { total, applied }, counts };
  } catch (e) {
    return { env, connection: { ok: false, error: e instanceof Error ? e.message : "Error de conexión" }, migrations: { total, applied: 0 }, counts: null };
  }
}

/** Crea o actualiza las tablas (migraciones de /drizzle) y carga el catálogo del POS si falta algo. No borra ni pisa datos. */
export async function prepareDatabase() {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const csv = await fs.readFile(path.join(process.cwd(), "data/pos-productos.csv"), "utf8");
  return seedCatalog(db, csv, new Set(Object.keys(PHOTO_MATCHES)));
}
