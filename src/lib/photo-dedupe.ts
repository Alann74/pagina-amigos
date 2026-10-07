import { eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, productImages, products, settings } from "@/db/schema";
import { colorDistance, hashDistance, imageHash, isSamePhoto } from "@/lib/media";
import { classifyPhoto, type PhotoKind } from "@/lib/photo-classify";

// Fotos repetidas: la misma toma puede estar en Drive con dos nombres (ej. "39606 1.jpg" y
// "39606 1_limpia.jpg", o "__21.A-39093_SET CON 39472" y "__21.B-39472_SET CON 39093").
// Se comparan por contenido: misma forma y mismo color (la misma prenda en otro color no es repetida).

// v2: la lista de la comparación anterior (que confundía colores) no se usa
const EXCLUDED_KEY = "fotos-excluidas-v2";

/** Fotos de Drive que no se vuelven a importar (repetidas que se sacaron), por artículo. */
export async function getExcludedDriveIds(): Promise<Record<string, string[]>> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, EXCLUDED_KEY) });
  return (row?.value as Record<string, string[]>) ?? {};
}

export async function excludeDriveIds(article: string, driveIds: string[]) {
  const excluded = await getExcludedDriveIds();
  excluded[article] = [...new Set([...(excluded[article] ?? []), ...driveIds])];
  await db.insert(settings).values({ key: EXCLUDED_KEY, value: excluded }).onConflictDoUpdate({ target: settings.key, set: { value: excluded } });
}

/** Calcula la huella de las fotos guardadas que no la tienen (usa la foto de la base, sin bajar nada). */
export async function backfillHashes(): Promise<number> {
  let done = 0;
  for (;;) {
    const rows = await db
      .select({ key: media.key, data: media.data })
      .from(media)
      .where(or(isNull(media.hash), sql`${media.hash} not like 'v2:%'`))
      .limit(60);
    if (rows.length === 0) return done;
    for (const r of rows) {
      const hash = await imageHash(r.data).catch(() => "error");
      await db.update(media).set({ hash }).where(eq(media.key, r.key));
      done++;
    }
  }
}

type Img = { id: number; productId: number; article: string | null; title: string | null; driveFileId: string | null; hash: string | null; sortOrder: number; key: string | null };

async function loadImages(): Promise<Img[]> {
  return db
    .select({ id: productImages.id, productId: productImages.productId, article: products.articleCode, title: productImages.sourceName, driveFileId: productImages.driveFileId, hash: media.hash, sortOrder: productImages.sortOrder, key: productImages.blobPath })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .leftJoin(media, sql`${media.key} = ${productImages.blobPath}`);
}

const KIND_SCORE: Record<PhotoKind, number> = { campana: 0, modelo: 1, look: 2, catalogo: 3, detalle: 4 };

/** Cuál de dos fotos iguales queda: la "limpia" (retocada), después la de mejor tipo y la que estaba antes. */
function keepScore(i: Img): number[] {
  const c = i.title ? classifyPhoto(i.title) : null;
  return [/limpia/i.test(i.title ?? "") ? 0 : 1, c ? KIND_SCORE[c.kind] : 5, i.sortOrder, i.id];
}

function better(a: Img, b: Img): Img {
  const x = keepScore(a);
  const y = keepScore(b);
  for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] < y[k] ? a : b;
  return a;
}

/**
 * Saca las fotos repetidas de cada producto (deja una) y las anota para que no se vuelvan a importar.
 * Solo borra si en la base está activado ("fotos-repetidas": { aplicar: true }); si no, deja la propuesta.
 */
export async function removeDuplicatePhotos() {
  const flag = await db.query.settings.findFirst({ where: eq(settings.key, "fotos-repetidas") });
  const apply = (flag?.value as { aplicar?: boolean } | undefined)?.aplicar === true;
  const images = (await loadImages()).filter((i) => i.hash?.startsWith("v2:"));
  const byProduct = new Map<number, Img[]>();
  for (const i of images) byProduct.set(i.productId, [...(byProduct.get(i.productId) ?? []), i]);
  const removed: { article: string | null; quitada: string | null; queda: string | null; forma: number; color: number }[] = [];
  const excluded = await getExcludedDriveIds();
  for (const list of byProduct.values()) {
    const kept: Img[] = [];
    for (const img of [...list].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const twin = kept.find((k) => isSamePhoto(k.hash!, img.hash!));
      if (!twin) {
        kept.push(img);
        continue;
      }
      const keep = better(twin, img);
      const drop = keep === twin ? img : twin;
      if (keep !== twin) kept[kept.indexOf(twin)] = img;
      removed.push({ article: drop.article, quitada: drop.title, queda: keep.title, forma: hashDistance(drop.hash!, keep.hash!), color: colorDistance(drop.hash!, keep.hash!) });
      if (!apply) continue;
      await db.delete(productImages).where(eq(productImages.id, drop.id));
      if (drop.key) {
        const still = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.blobPath, drop.key)).limit(1);
        if (still.length === 0) await db.delete(media).where(eq(media.key, drop.key));
      }
      if (drop.article && drop.driveFileId) excluded[drop.article] = [...new Set([...(excluded[drop.article] ?? []), drop.driveFileId])];
    }
  }
  if (!apply) {
    const value = { fecha: new Date().toISOString(), propuesta: removed };
    await db.insert(settings).values({ key: "fotos-repetidas-propuesta", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
    return [];
  }
  if (removed.length) {
    await db.insert(settings).values({ key: EXCLUDED_KEY, value: excluded }).onConflictDoUpdate({ target: settings.key, set: { value: excluded } });
    const log = await db.query.settings.findFirst({ where: eq(settings.key, "fotos-repetidas-quitadas") });
    const value = { fecha: new Date().toISOString(), quitadas: [...(((log?.value as { quitadas?: unknown[] })?.quitadas as typeof removed) ?? []), ...removed] };
    await db.insert(settings).values({ key: "fotos-repetidas-quitadas", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  return removed;
}

/** La misma foto en artículos distintos (posible foto en el artículo equivocado), salvo los conjuntos. */
export async function crossProductReport() {
  const images = (await loadImages()).filter((i) => i.hash?.startsWith("v2:"));
  const pairs: { a: string | null; artA: string | null; b: string | null; artB: string | null; forma: number; color: number }[] = [];
  for (let i = 0; i < images.length; i++)
    for (let j = i + 1; j < images.length; j++) {
      const a = images[i];
      const b = images[j];
      if (a.productId === b.productId || a.driveFileId === b.driveFileId || !isSamePhoto(a.hash!, b.hash!)) continue;
      // Conjuntos: la foto nombra a los dos artículos
      const ca = classifyPhoto(a.title ?? "")?.codes ?? [];
      const cb = classifyPhoto(b.title ?? "")?.codes ?? [];
      if (b.article && ca.includes(b.article) && a.article && cb.includes(a.article)) continue;
      pairs.push({ a: a.title, artA: a.article, b: b.title, artB: b.article, forma: hashDistance(a.hash!, b.hash!), color: colorDistance(a.hash!, b.hash!) });
    }
  const value = { fecha: new Date().toISOString(), pares: pairs.slice(0, 200), total: pairs.length };
  await db.insert(settings).values({ key: "fotos-otro-articulo", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  return value;
}

