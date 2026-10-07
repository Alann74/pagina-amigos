import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, productImages, products, settings } from "@/db/schema";
import { mediaKeyFromUrl } from "@/lib/media";
import { SITE_URL } from "@/lib/site";

// Revisión de todas las fotos del catálogo desde el servidor: cada foto tiene que existir en sus
// tres tamaños WebP (400, 800 y 1200) y en JPG (respaldo y para compartir).

const WEBP = /-w\d+\.webp$/;

export type PhotoCheck = {
  fecha: string;
  productosPublicados: number;
  productosSinFoto: { article: string | null; name: string }[];
  fotos: number;
  archivos: number;
  rotas: { article: string | null; name: string; url: string; estado: number | string }[];
  segundos: number;
};

function variants(url: string): string[] {
  const abs = url.startsWith("http") ? url : `${SITE_URL}${url}`;
  if (!WEBP.test(abs)) return [abs];
  return [400, 800, 1200].map((w) => abs.replace(WEBP, `-w${w}.webp`)).concat(abs.replace(WEBP, "-share.jpg"));
}

async function head(url: string): Promise<number | string> {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const r = await fetch(url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (r.ok || r.status === 404 || r.status === 403) return r.status;
    } catch (e) {
      if (intento === 1) return e instanceof Error ? e.message.slice(0, 60) : "error";
    }
  }
  return "sin respuesta";
}

export async function checkAllProductPhotos(): Promise<PhotoCheck> {
  const t0 = Date.now();
  const rows = await db
    .select({ url: productImages.url, article: products.articleCode, name: products.name })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(eq(products.visible, true))
    .orderBy(asc(products.name), asc(productImages.sortOrder));
  const sinFoto = await db
    .select({ article: products.articleCode, name: products.name })
    .from(products)
    .where(sql`${products.visible} and ${products.price} > 0 and not exists (select 1 from product_images pi where pi.product_id = ${products.id})`);
  const [{ publicados }] = await db
    .select({ publicados: sql<number>`count(*)`.mapWith(Number) })
    .from(products)
    .where(sql`${products.visible} and ${products.price} > 0 and exists (select 1 from product_images pi where pi.product_id = ${products.id})`);

  // Fotos guardadas en la base: alcanza con que exista la versión grande (los tamaños se generan al pedirlos)
  const rotas: PhotoCheck["rotas"] = [];
  const enBase = rows.filter((r) => mediaKeyFromUrl(r.url));
  const keys = [...new Set(enBase.map((r) => mediaKeyFromUrl(r.url)!))];
  const existentes = new Set<string>();
  for (let k = 0; k < keys.length; k += 500) {
    const part = await db.select({ key: media.key }).from(media).where(inArray(media.key, keys.slice(k, k + 500)));
    for (const p of part) existentes.add(p.key);
  }
  for (const r of enBase) if (!existentes.has(mediaKeyFromUrl(r.url)!)) rotas.push({ article: r.article, name: r.name, url: r.url, estado: "falta en la base" });
  const jobs = rows.filter((r) => !mediaKeyFromUrl(r.url)).flatMap((r) => variants(r.url).map((url) => ({ ...r, url })));
  let i = 0;
  await Promise.all(
    Array.from({ length: 24 }, async () => {
      while (i < jobs.length) {
        const job = jobs[i++];
        const estado = await head(job.url);
        if (estado !== 200) rotas.push({ article: job.article, name: job.name, url: job.url, estado });
      }
    }),
  );
  const result: PhotoCheck = {
    fecha: new Date().toISOString(),
    productosPublicados: publicados,
    productosSinFoto: sinFoto,
    fotos: rows.length,
    archivos: jobs.length + enBase.length,
    rotas: rotas.slice(0, 200),
    segundos: Math.round((Date.now() - t0) / 1000),
  };
  await db.insert(settings).values({ key: "diagnostico-fotos", value: result }).onConflictDoUpdate({ target: settings.key, set: { value: result } });
  return result;
}
