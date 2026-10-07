import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";

// Fotos guardadas en la base: una versión grande por foto. La web las pide por /m/<clave>-w800.webp,
// /m/<clave>-share.jpg, etc. (ver src/app/m/[...path]/route.ts).

export const MEDIA_PREFIX = "/m/";

/** Vercel Blob (con el plan gratis se suspendió al pasar el límite) solo si se pide explícitamente. */
export function blobStorageSelected(): boolean {
  return process.env.MEDIA_STORAGE === "blob" && Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function saveMedia(key: string, data: Buffer, contentType: string, width: number, height: number): Promise<void> {
  const value = { key, data, contentType, width, height, bytes: data.length };
  await db.insert(media).values(value).onConflictDoUpdate({ target: media.key, set: { data, contentType, width, height, bytes: data.length, createdAt: new Date() } });
}

export async function deleteMedia(keys: string[]): Promise<void> {
  if (keys.length) await db.delete(media).where(inArray(media.key, keys));
}

/** "/m/p/39603-abc-w1200.webp" → "p/39603-abc" */
export function mediaKeyFromUrl(url: string): string | null {
  if (!url.startsWith(MEDIA_PREFIX)) return null;
  return url.slice(MEDIA_PREFIX.length).replace(/-(w\d+\.webp|share\.jpg)$/, "");
}
