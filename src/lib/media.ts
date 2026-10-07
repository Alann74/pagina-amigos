import { inArray } from "drizzle-orm";
import sharp from "sharp";
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
  const hash = await imageHash(data).catch(() => null);
  const value = { key, data, contentType, width, height, bytes: data.length, hash };
  await db.insert(media).values(value).onConflictDoUpdate({ target: media.key, set: { data, contentType, width, height, bytes: data.length, hash, createdAt: new Date() } });
}

/** Huella perceptual (dHash 16x16 = 256 bits, en hex). */
export async function imageHash(data: Buffer): Promise<string> {
  const { data: px } = await sharp(data, { failOn: "none" }).flatten({ background: "#ffffff" }).grayscale().resize(17, 16, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let hex = "";
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x += 4) {
      let nibble = 0;
      for (let b = 0; b < 4; b++) nibble = (nibble << 1) | (px[y * 17 + x + b] > px[y * 17 + x + b + 1] ? 1 : 0);
      hex += nibble.toString(16);
    }
  }
  return hex;
}

/** Bits distintos entre dos huellas (0 = idénticas; < ~12 = la misma foto). */
export function hashDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export async function deleteMedia(keys: string[]): Promise<void> {
  if (keys.length) await db.delete(media).where(inArray(media.key, keys));
}

/** "/m/p/39603-abc-w1200.webp" → "p/39603-abc" */
export function mediaKeyFromUrl(url: string): string | null {
  if (!url.startsWith(MEDIA_PREFIX)) return null;
  return url.slice(MEDIA_PREFIX.length).replace(/-(w\d+\.webp|share\.jpg)$/, "");
}
