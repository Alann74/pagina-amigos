import { eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, productImages, products, settings } from "@/db/schema";
import { hashDistance, imageHash } from "@/lib/media";

// Fotos repetidas: la misma toma puede estar en Drive con dos nombres (ej. "39606 1.jpg" y
// "39606 1_limpia.jpg") o en dos carpetas. Se comparan por contenido (huella perceptual).

/** Calcula la huella de las fotos guardadas que todavía no la tienen (sin bajar nada: usa la foto de la base). */
export async function backfillHashes(): Promise<number> {
  let done = 0;
  for (;;) {
    const rows = await db.select({ key: media.key, data: media.data }).from(media).where(isNull(media.hash)).limit(60);
    if (rows.length === 0) return done;
    for (const r of rows) {
      const hash = await imageHash(r.data).catch(() => "error");
      await db.update(media).set({ hash }).where(eq(media.key, r.key));
      done++;
    }
  }
}

export type DuplicatePair = { article: string | null; a: string; b: string; ida: number; idb: number; distancia: number };

/** Pares de fotos casi iguales dentro de cada producto, y la misma foto en productos distintos. */
export async function duplicateReport(maxDistance = 40) {
  const rows = await db
    .select({ id: productImages.id, productId: productImages.productId, article: products.articleCode, title: productImages.sourceName, hash: media.hash, sortOrder: productImages.sortOrder })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .innerJoin(media, sql`${media.key} = ${productImages.blobPath}`);
  const byProduct = new Map<number, typeof rows>();
  for (const r of rows) byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r]);
  const mismoProducto: DuplicatePair[] = [];
  for (const list of byProduct.values()) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a.hash || !b.hash || a.hash === "error" || b.hash === "error") continue;
        const d = hashDistance(a.hash, b.hash);
        if (d <= maxDistance) mismoProducto.push({ article: a.article, a: a.title ?? String(a.id), b: b.title ?? String(b.id), ida: a.id, idb: b.id, distancia: d });
      }
  }
  // La misma foto (casi idéntica) en dos artículos distintos que no comparten el nombre del archivo
  const otrosProductos: { a: string; b: string; artA: string | null; artB: string | null; distancia: number }[] = [];
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (a.productId === b.productId || !a.hash || !b.hash || a.title === b.title) continue;
      const d = hashDistance(a.hash, b.hash);
      if (d <= 8) otrosProductos.push({ a: a.title ?? "", b: b.title ?? "", artA: a.article, artB: b.article, distancia: d });
    }
  mismoProducto.sort((x, y) => x.distancia - y.distancia);
  const report = { fecha: new Date().toISOString(), fotos: rows.length, mismoProducto, otrosProductos: otrosProductos.slice(0, 200) };
  await db.insert(settings).values({ key: "fotos-duplicadas-reporte", value: report }).onConflictDoUpdate({ target: settings.key, set: { value: report } });
  return report;
}
