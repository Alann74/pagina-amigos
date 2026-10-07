// Completa las descripciones vacías con data/descripciones.json (nunca pisa las editadas en el admin).
// Corre en cada deploy (npm run vercel-build).   tsx scripts/descriptions.ts [--skip-if-missing]
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { DESCRIPCIONES, descriptionMarkdown } from "../src/lib/descriptions";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.argv.includes("--skip-if-missing")) return console.warn("Sin DATABASE_URL: no se cargan descripciones");
    throw new Error("Falta DATABASE_URL");
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool, { schema });
  let updated = 0;
  for (const [article, d] of Object.entries(DESCRIPCIONES)) {
    const res = await db
      .update(schema.products)
      .set({ description: descriptionMarkdown(d) })
      .where(and(eq(schema.products.articleCode, article), eq(schema.products.description, "")))
      .returning({ id: schema.products.id });
    updated += res.length;
  }
  await pool.end();
  console.log(`Descripciones completadas: ${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
