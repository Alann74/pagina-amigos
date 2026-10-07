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

/**
 * Huella de la foto: "forma|color". Forma = dHash 16x16 (256 bits en hex); color = grilla 4x4 de colores
 * promedio (48 bytes en hex). La misma prenda en otro color tiene la misma forma pero distinto color.
 */
export async function imageHash(data: Buffer): Promise<string> {
  const base = sharp(data, { failOn: "none" }).flatten({ background: "#ffffff" });
  const { data: px } = await base.clone().grayscale().resize(17, 16, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let shape = "";
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x += 4) {
      let nibble = 0;
      for (let b = 0; b < 4; b++) nibble = (nibble << 1) | (px[y * 17 + x + b] > px[y * 17 + x + b + 1] ? 1 : 0);
      shape += nibble.toString(16);
    }
  }
  const { data: rgb } = await base.clone().removeAlpha().resize(4, 4, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  return `${shape}|${Buffer.from(rgb).toString("hex")}`;
}

/** Bits distintos entre las formas (0 = idénticas; < ~12 = la misma toma). */
export function hashDistance(a: string, b: string): number {
  const x = a.split("|")[0];
  const y = b.split("|")[0];
  let d = 0;
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    let v = parseInt(x[i], 16) ^ parseInt(y[i], 16);
    while (v) {
      d += v & 1;
      v >>= 1;
    }
  }
  return d;
}

/** Diferencia media de color (0-255) entre las grillas 4x4; sin dato de color, 0. */
export function colorDistance(a: string, b: string): number {
  const x = a.split("|")[1];
  const y = b.split("|")[1];
  if (!x || !y || x.length !== y.length) return 0;
  let sum = 0;
  for (let i = 0; i < x.length; i += 2) sum += Math.abs(parseInt(x.slice(i, i + 2), 16) - parseInt(y.slice(i, i + 2), 16));
  return Math.round(sum / (x.length / 2));
}

/** La misma foto: misma forma y mismo color. */
export function isSamePhoto(a: string, b: string): boolean {
  return hashDistance(a, b) <= 12 && colorDistance(a, b) <= 12;
}

export async function deleteMedia(keys: string[]): Promise<void> {
  if (keys.length) await db.delete(media).where(inArray(media.key, keys));
}

/** "/m/p/39603-abc-w1200.webp" → "p/39603-abc" */
export function mediaKeyFromUrl(url: string): string | null {
  if (!url.startsWith(MEDIA_PREFIX)) return null;
  return url.slice(MEDIA_PREFIX.length).replace(/-(w\d+\.webp|share\.jpg)$/, "");
}
