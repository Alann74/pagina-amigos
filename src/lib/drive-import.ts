import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { colors, productImages, products, settings } from "@/db/schema";
import { imageRatio, processCampaignImage, processProductImage } from "@/lib/images";
import matches from "../../data/photo-matches.json";
import unmatched from "../../data/photo-unmatched.json";

// Fotos de Drive ("Temporada 3 (2027)" → "FOTOS DE CAPSULAS LIMPIAS") ya cruzadas con los artículos
// por scripts/match-photos.mjs. Se descargan, se optimizan y se suben a Vercel Blob: la web nunca enlaza a Drive.

export type DriveMatch = { driveId: string; title: string; kind: "catalogo" | "campana" | "look"; color: string | null; back: boolean; look?: string[] };

export const PHOTO_MATCHES = matches as Record<string, DriveMatch[]>;
export const PHOTO_UNMATCHED = unmatched as { codes: Record<string, string[]>; noCode: string[] };

const MAX_DOWNLOAD = 40 * 1024 * 1024;

export async function downloadDriveFile(id: string): Promise<Buffer> {
  if (!/^[\w-]{10,}$/.test(id)) throw new Error("ID de Drive inválido");
  const url = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
  const res = await fetch(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Drive respondió ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("text/html")) throw new Error("Drive no devolvió la imagen (revisá que la carpeta siga compartida con “cualquiera con el enlace”)");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_DOWNLOAD) throw new Error("Archivo demasiado grande");
  return buf;
}

export type PhotoStatus = { article: string; productId: number | null; name: string | null; total: number; imported: number; visible: boolean };

/** Estado de la importación por artículo (para la pantalla de fotos del admin). */
export async function getPhotoStatus(): Promise<PhotoStatus[]> {
  const rows = await db
    .select({ id: products.id, articleCode: products.articleCode, name: products.name, visible: products.visible })
    .from(products)
    .where(sql`${products.articleCode} is not null`);
  const byArticle = new Map(rows.map((r) => [r.articleCode!, r]));
  const imported = await db
    .select({ productId: productImages.productId, driveFileId: productImages.driveFileId })
    .from(productImages)
    .where(sql`${productImages.driveFileId} is not null`);
  const importedBy = new Map<number, Set<string>>();
  for (const r of imported) {
    const set = importedBy.get(r.productId) ?? new Set<string>();
    set.add(r.driveFileId!);
    importedBy.set(r.productId, set);
  }
  return Object.entries(PHOTO_MATCHES).map(([article, list]) => {
    const p = byArticle.get(article);
    const done = p ? importedBy.get(p.id) : undefined;
    return {
      article,
      productId: p?.id ?? null,
      name: p?.name ?? null,
      total: list.length,
      imported: done ? list.filter((m) => done.has(m.driveId)).length : 0,
      visible: p?.visible ?? false,
    };
  });
}

/**
 * Importa hasta `limit` fotos pendientes de un artículo. Es idempotente: si se corta, se vuelve a correr
 * y sigue donde quedó (no duplica). El orden final respeta el del cruce (principal, hover, resto).
 */
export async function importArticlePhotos(article: string, limit = 3) {
  const list = PHOTO_MATCHES[article];
  if (!list) return { imported: 0, remaining: 0, errors: [`El artículo ${article} no tiene fotos en Drive`] };
  const product = await db.query.products.findFirst({ where: eq(products.articleCode, article) });
  if (!product) return { imported: 0, remaining: 0, errors: [`No hay producto con artículo ${article}`] };

  const existing = await db.select({ driveFileId: productImages.driveFileId }).from(productImages).where(eq(productImages.productId, product.id));
  const done = new Set(existing.map((e) => e.driveFileId).filter(Boolean));
  const pending = list.map((m, index) => ({ ...m, index })).filter((m) => !done.has(m.driveId));

  const colorNames = [...new Set(list.map((m) => m.color).filter((c): c is string => Boolean(c)))];
  const colorRows = colorNames.length ? await db.select({ id: colors.id, name: colors.name }).from(colors).where(inArray(colors.name, colorNames)) : [];
  const colorId = new Map(colorRows.map((c) => [c.name, c.id]));

  const errors: string[] = [];
  let imported = 0;
  for (const m of pending.slice(0, limit)) {
    try {
      const buffer = await downloadDriveFile(m.driveId);
      // Las de catálogo (prenda sola, PNG recortada) van enteras sobre blanco; las de campaña se recortan a 3:4
      // desde arriba si la proporción es parecida (no se cortan cabezas).
      const ratio = await imageRatio(buffer);
      const fit = m.kind !== "catalogo" && ratio !== null && ratio >= 1.2 && ratio <= 1.55 ? "cover" : "contain";
      const base = `p/${article}-${m.driveId.slice(0, 12)}`;
      const img = await processProductImage(buffer, base, { fit });
      await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: img.url,
          blobPath: base,
          alt: m.color ? `${product.name} — ${m.color.toLowerCase()}` : product.name,
          colorId: m.color ? (colorId.get(m.color) ?? null) : null,
          sortOrder: m.index,
          width: img.width,
          height: img.height,
          driveFileId: m.driveId,
          sourceName: m.title,
        })
        .onConflictDoNothing();
      imported++;
    } catch (e) {
      errors.push(`${m.title}: ${e instanceof Error ? e.message : "error"}`);
    }
  }
  // Si ya tiene foto y precio, queda publicado (salvo que alguien lo haya ocultado a mano después)
  if (imported > 0 && existing.length === 0 && product.price > 0) {
    await db.update(products).set({ visible: true }).where(and(eq(products.id, product.id)));
  }
  return { imported, remaining: Math.max(0, pending.length - imported - errors.length), errors };
}

/** Looks (fotos "SET CON …" con dos o más artículos cargados) para elegir el bloque "Comprá el look". */
export function getLookCandidates() {
  const seen = new Map<string, { driveId: string; title: string; codes: string[] }>();
  for (const list of Object.values(PHOTO_MATCHES)) {
    for (const m of list) if (m.kind === "look" && m.look && !seen.has(m.driveId)) seen.set(m.driveId, { driveId: m.driveId, title: m.title, codes: m.look });
  }
  // Primero las fotos de campaña de conjuntos ("SET CON"), después las de catálogo con varias prendas
  const isSet = (t: string) => (/set con/i.test(t) ? 0 : 1);
  return [...seen.values()].sort((a, b) => isSet(a.title) - isSet(b.title) || a.title.localeCompare(b.title));
}

/** Descarga una foto de campaña de Drive y la usa como portada o como "Comprá el look". */
export async function applyDrivePhoto(target: "hero" | "hero2" | "look", driveId: string, codes: string[]) {
  const buffer = await downloadDriveFile(driveId);
  const img = await processCampaignImage(buffer, `c/${target}-${driveId.slice(0, 12)}`);
  if (target === "look") {
    const ids = codes.length ? await db.select({ id: products.id }).from(products).where(inArray(products.articleCode, codes)) : [];
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "look") });
    const value = { ...((row?.value as Record<string, unknown>) ?? {}), enabled: true, imageUrl: img.url, productIds: ids.map((r) => r.id) };
    await db.insert(settings).values({ key: "look", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  } else {
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "site") });
    const current = (row?.value as Record<string, unknown>) ?? {};
    const hero = { ...((current.hero as Record<string, unknown>) ?? {}), [target === "hero" ? "imageUrl" : "secondaryImageUrl"]: img.url };
    const value = { ...current, hero };
    await db.insert(settings).values({ key: "site", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  return img.url;
}
