import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, productImages, products, settings } from "@/db/schema";
import { downloadDriveFile } from "@/lib/drive-import";
import { processProductImage } from "@/lib/images";
import { deferMediaDelete } from "@/lib/media";
import { classifyPhoto } from "@/lib/photo-classify";

// Fotos con modelo que quedaron con bandas blancas a los costados (se guardaron enteras sobre el lienzo 3:4,
// como si fueran de la prenda sola): se vuelven a bajar de Drive y se encuadran llenando el lienzo.
// Se guardan con otra dirección (las anteriores quedan en la caché de los navegadores por un año).

const KEY = "fotos-encuadre";

type State = Record<string, "ok" | "rehecha">;

/** ¿Tiene bandas blancas parejas a la izquierda y a la derecha (foto entera sobre el lienzo)? */
export async function hasSideBars(data: Buffer): Promise<boolean> {
  const { data: px, info } = await sharp(data, { failOn: "none" }).flatten({ background: "#ffffff" }).resize(120, 160, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const whiteColumn = (x: number) => {
    for (let y = 0; y < info.height; y++) {
      const k = (y * info.width + x) * 3;
      if (Math.min(px[k], px[k + 1], px[k + 2]) < 246) return false;
    }
    return true;
  };
  return whiteColumn(0) && whiteColumn(1) && whiteColumn(info.width - 1) && whiteColumn(info.width - 2);
}

export async function refitModelPhotos(budgetMs: number) {
  const started = Date.now();
  const row = await db.query.settings.findFirst({ where: eq(settings.key, KEY) });
  const state = (row?.value as State | undefined) ?? {};
  const vista = ((await db.query.settings.findFirst({ where: eq(settings.key, "orden-fotos-v2") }))?.value as { vista?: Record<string, string> } | undefined)?.vista ?? {};
  const rows = await db
    .select({ id: productImages.id, key: productImages.blobPath, driveFileId: productImages.driveFileId, title: productImages.sourceName, article: products.articleCode })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(sql`${productImages.driveFileId} is not null and ${productImages.blobPath} is not null`);
  // Solo fotos con modelo (la prenda sola sobre blanco no tiene problema con las bandas)
  const candidates = rows.filter((r) => {
    if (state[r.key!]) return false;
    const c = classifyPhoto(r.title ?? "");
    if (!c || c.kind === "catalogo" || c.kind === "detalle") return false;
    return !(c.dudosa && vista[r.key!] === "prenda");
  });
  let rehechas = 0;
  let errores = 0;
  for (const r of candidates) {
    if (Date.now() - started > budgetMs) break;
    const key = r.key!;
    try {
      const m = await db.query.media.findFirst({ where: eq(media.key, key), columns: { data: true } });
      if (!m || !(await hasSideBars(m.data))) {
        state[key] = "ok";
        continue;
      }
      const original = await downloadDriveFile(r.driveFileId!);
      const meta = await sharp(original, { failOn: "none" }).rotate().metadata();
      // Apaisada: va entera (no se recorta)
      if (!meta.width || !meta.height || meta.height / meta.width < 1.1) {
        state[key] = "ok";
        continue;
      }
      const newKey = `${key.replace(/-e$/, "")}-e`;
      const img = await processProductImage(original, newKey, { fit: "cover" });
      await db.update(productImages).set({ url: img.url, blobPath: newKey, width: img.width, height: img.height }).where(eq(productImages.id, r.id));
      await deferMediaDelete([key]);
      state[key] = "rehecha";
      state[newKey] = "ok";
      rehechas++;
    } catch {
      // Se reintenta en el próximo deploy
      errores++;
    }
  }
  await db.insert(settings).values({ key: KEY, value: state }).onConflictDoUpdate({ target: settings.key, set: { value: state } });
  const pendientes = candidates.filter((r) => !state[r.key!]).length;
  return { revisadas: candidates.length - pendientes, rehechas, errores, pendientes };
}
