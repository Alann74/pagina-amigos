// Carga categorías, colores, productos y variantes desde data/pos-productos.csv (export del POS).
// Es idempotente y no pisa datos existentes: solo agrega lo que falta.   npm run db:seed
// (Lo mismo hace el botón "Preparar base de datos" en /admin/instalacion.)
import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { seedCatalog } from "../src/lib/catalog-seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const pool = new Pool({ connectionString: url, max: 2 });
  const db = drizzle(pool, { schema });
  const csv = fs.readFileSync(path.join(process.cwd(), "data/pos-productos.csv"), "utf8");
  const matchesPath = path.join(process.cwd(), "data/photo-matches.json");
  const withPhotos = fs.existsSync(matchesPath) ? new Set(Object.keys(JSON.parse(fs.readFileSync(matchesPath, "utf8")))) : null;
  console.log(await seedCatalog(db, csv, withPhotos));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
