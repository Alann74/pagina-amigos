// SOLO DESARROLLO: genera fotos de prueba (grises) para ver el diseño sin las fotos reales.
// Se niega a correr contra una base que no sea local.
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import sharp from "sharp";
import * as schema from "../src/db/schema";
import { processCampaignImage, processProductImage } from "../src/lib/images";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("dev-placeholders solo corre contra una base local");
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const pool = new Pool({ connectionString: url, max: 2 });
  const db = drizzle(pool, { schema });
  const products = await db.select().from(schema.products).where(eq(schema.products.visible, true));
  const tones = [232, 222, 212, 202, 192, 182];
  const make = async (tone: number, w: number, h: number, label: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(${tone},${tone},${tone})"/><stop offset="1" stop-color="rgb(${tone - 18},${tone - 18},${tone - 18})"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="${w * 0.3}" y="${h * 0.18}" width="${w * 0.4}" height="${h * 0.62}" fill="rgb(${tone - 40},${tone - 40},${tone - 40})"/><text x="50%" y="92%" font-family="Arial" font-size="${w * 0.035}" fill="#555" text-anchor="middle" letter-spacing="6">${label}</text></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  };
  let i = 0;
  for (const p of products) {
    const existing = await db.select().from(schema.productImages).where(eq(schema.productImages.productId, p.id));
    if (existing.length) continue;
    for (let k = 0; k < 2; k++) {
      const buf = await make(tones[(i + k) % tones.length], 900, 1200, `${p.articleCode ?? ""} · ${k + 1}`);
      const img = await processProductImage(buf, `p/dev/${p.articleCode ?? p.id}-${k + 1}`);
      await db.insert(schema.productImages).values({ productId: p.id, url: img.url, alt: p.name, sortOrder: k, width: img.width, height: img.height, sourceName: "placeholder-dev" });
    }
    i++;
  }
  const hero = await processCampaignImage(await make(200, 1600, 1000, "INEDITA · CAMPAÑA"), "c/dev/hero");
  const look = await processCampaignImage(await make(214, 1200, 1500, "COMPRÁ EL LOOK"), "c/dev/look");
  const lookIds = products.slice(0, 3).map((p) => p.id);
  await db.insert(schema.settings).values({ key: "look", value: { enabled: true, title: "Comprá el look", imageUrl: look.url, productIds: lookIds } }).onConflictDoUpdate({ target: schema.settings.key, set: { value: { enabled: true, title: "Comprá el look", imageUrl: look.url, productIds: lookIds } } });
  console.log({ productos: i, hero: hero.url, look: look.url });
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
