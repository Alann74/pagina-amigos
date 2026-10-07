import { timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { productImages, products, settings } from "@/db/schema";
import { applyDrivePhoto, downloadDriveFile, fitFor, getLookCandidates, getPhotoStatus, importArticlePhotos, PHOTO_MATCHES } from "@/lib/drive-import";
import { imageRatio, processCampaignImage, processProductImage } from "@/lib/images";
import { MEDIA_PREFIX } from "@/lib/media";

// Importación de todas las fotos de Drive sin tener que dejar el admin abierto: corre en segundo plano
// en tandas de ~4 minutos y se vuelve a llamar sola hasta terminar. Se dispara con MAINTENANCE_TOKEN.

export function validMaintenanceToken(given: string | null): boolean {
  const expected = process.env.MAINTENANCE_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function photoProgress() {
  const status = await getPhotoStatus();
  const withProduct = status.filter((s) => s.productId);
  return {
    articles: withProduct.length,
    complete: withProduct.filter((s) => s.imported >= s.total).length,
    files: withProduct.reduce((a, s) => a + s.total, 0),
    imported: withProduct.reduce((a, s) => a + s.imported, 0),
  };
}

/** Procesa artículos pendientes (varios a la vez) hasta `budgetMs`. Devuelve si quedó trabajo. */
export async function importPendingPhotos(budgetMs: number, concurrency = 3) {
  const started = Date.now();
  const status = await getPhotoStatus();
  // Orden al azar: si hay varias tandas corriendo a la vez, no procesan los mismos artículos
  const queue = status
    .filter((s) => s.productId && s.imported < s.total)
    .map((s) => ({ article: s.article, key: Math.random() }))
    .sort((x, y) => x.key - y.key)
    .map((x) => x.article);
  const failedBy = new Map<string, string[]>();
  const errors: string[] = [];
  let imported = 0;
  const worker = async () => {
    while (queue.length && Date.now() - started < budgetMs) {
      const article = queue.shift()!;
      for (let round = 0; round < 30 && Date.now() - started < budgetMs; round++) {
        const skip = failedBy.get(article) ?? [];
        const r = await importArticlePhotos(article, 3, skip);
        imported += r.imported;
        if (r.failed.length) failedBy.set(article, [...skip, ...r.failed]);
        errors.push(...r.errors);
        if (!r.remaining || r.imported + r.failed.length === 0) break;
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { imported, errors, pending: queue.length > 0 || Date.now() - started >= budgetMs };
}

/** Si todavía no se eligieron, usa fotos de conjuntos ("SET CON …") para la portada y "Comprá el look". */
export async function autoConfigureCampaign() {
  const done: string[] = [];
  const looks = getLookCandidates().filter((l) => /set con/i.test(l.title) && l.codes.every((c) => PHOTO_MATCHES[c]));
  if (looks.length === 0) return done;
  const look = await db.query.settings.findFirst({ where: eq(settings.key, "look") });
  if (!(look?.value as { imageUrl?: string | null } | undefined)?.imageUrl) {
    await applyDrivePhoto("look", looks[0].driveId, looks[0].codes);
    done.push("look");
  }
  const site = await db.query.settings.findFirst({ where: eq(settings.key, "site") });
  const hero = (site?.value as { hero?: { imageUrl?: string | null } } | undefined)?.hero;
  if (!hero?.imageUrl && looks.length >= 3) {
    await applyDrivePhoto("hero", looks[1].driveId, []);
    await applyDrivePhoto("hero2", looks[2].driveId, []);
    done.push("portada");
  }
  return done;
}

/** Registro de la importación en la base (clave "photo_import_log"): últimos 30 eventos. */
export async function logImport(event: Record<string, unknown>) {
  try {
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "photo_import_log") });
    const list = Array.isArray((row?.value as { events?: unknown[] } | undefined)?.events) ? (row!.value as { events: unknown[] }).events : [];
    const value = { events: [...list, { at: new Date().toISOString(), ...event }].slice(-30) };
    await db.insert(settings).values({ key: "photo_import_log", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  } catch (e) {
    console.error("[fotos] no se pudo registrar", e);
  }
}

/** Prueba de punta a punta con una sola foto (bajar de Drive → procesar → subir), sin tocar el catálogo. */
export async function testOnePhoto() {
  const first = Object.values(PHOTO_MATCHES)[0]?.[0];
  if (!first) return { ok: false, paso: "datos", error: "No hay fotos cruzadas" };
  const t0 = Date.now();
  let buffer: Buffer;
  try {
    buffer = await downloadDriveFile(first.driveId);
  } catch (e) {
    return { ok: false, paso: "descarga de Drive", archivo: first.title, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    const img = await processProductImage(buffer, `p/_prueba-${first.driveId.slice(0, 8)}`);
    return { ok: true, archivo: first.title, bytes: buffer.length, url: img.url, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, paso: "procesar/subir a Blob", archivo: first.title, bytes: buffer.length, error: e instanceof Error ? e.message : String(e) };
  }
}

// ------------------------------------------------------------------ paso de Vercel Blob a la base

const ALL_DRIVE_IDS = () => [...new Set(Object.values(PHOTO_MATCHES).flatMap((l) => l.map((m) => m.driveId)))];

/**
 * Las fotos que estaban en Vercel Blob (suspendido en el plan gratis) se vuelven a procesar desde el original
 * de Drive y se guardan en la base. Idempotente: si se corta, sigue con las que falten.
 */
export async function migrateImagesToDb(budgetMs: number, concurrency = 6) {
  const started = Date.now();
  const rows = await db
    .select({ id: productImages.id, driveFileId: productImages.driveFileId, article: products.articleCode })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(sql`${productImages.url} not like ${MEDIA_PREFIX + "%"} and ${productImages.driveFileId} is not null`);
  const queue = [...rows];
  const errors: string[] = [];
  let moved = 0;
  const worker = async () => {
    while (queue.length && Date.now() - started < budgetMs) {
      const r = queue.shift()!;
      try {
        const buffer = await downloadDriveFile(r.driveFileId!);
        const kind = (r.article ? PHOTO_MATCHES[r.article]?.find((m) => m.driveId === r.driveFileId)?.kind : undefined) ?? "catalogo";
        const base = `p/${r.article ?? "x"}-${r.driveFileId!.slice(0, 12)}`;
        const img = await processProductImage(buffer, base, { fit: fitFor(kind, await imageRatio(buffer)) });
        await db.update(productImages).set({ url: img.url, blobPath: base, width: img.width, height: img.height }).where(eq(productImages.id, r.id));
        moved++;
      } catch (e) {
        errors.push(`${r.article} ${r.driveFileId}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { moved, errors, pending: queue.length };
}

/** Portada y "Comprá el look": si apuntan a Vercel Blob, se regeneran desde Drive en la base. */
export async function migrateCampaignToDb() {
  const ids = ALL_DRIVE_IDS();
  const moved: string[] = [];
  const convert = async (url: unknown): Promise<string | null> => {
    if (typeof url !== "string" || url.startsWith(MEDIA_PREFIX)) return null;
    const m = url.match(/\/c\/([a-z0-9]+)-([\w-]{12})-(?:w\d+\.webp|share\.jpg)$/i);
    if (!m) return null;
    const driveId = ids.find((id) => id.startsWith(m[2]));
    if (!driveId) return null;
    const img = await processCampaignImage(await downloadDriveFile(driveId), `c/${m[1]}-${m[2]}`);
    moved.push(img.url);
    return img.url;
  };
  const site = await db.query.settings.findFirst({ where: eq(settings.key, "site") });
  if (site) {
    const value = site.value as { hero?: Record<string, unknown> };
    const hero = { ...(value.hero ?? {}) };
    let changed = false;
    for (const k of ["imageUrl", "secondaryImageUrl", "mobileImageUrl"]) {
      const next = await convert(hero[k]).catch(() => null);
      if (next) {
        hero[k] = next;
        changed = true;
      }
    }
    if (changed) await db.update(settings).set({ value: { ...value, hero } }).where(eq(settings.key, "site"));
  }
  const look = await db.query.settings.findFirst({ where: eq(settings.key, "look") });
  if (look) {
    const value = look.value as { imageUrl?: unknown };
    const next = await convert(value.imageUrl).catch(() => null);
    if (next) await db.update(settings).set({ value: { ...value, imageUrl: next } }).where(eq(settings.key, "look"));
  }
  return moved;
}
