import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { media, productImages, settings } from "@/db/schema";

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
 * Huella de la foto, "v2:forma|miniatura". Forma = dHash 16x16 (256 bits en hex). Miniatura = 16x24 en color
 * (RGB). Dos fotos son la misma si la forma es casi igual y la miniatura casi idéntica sobre la prenda
 * (sin contar el fondo blanco): así no se confunden la prenda en otro color ni el frente con la espalda.
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
  const { data: rgb } = await base.clone().removeAlpha().resize(16, 24, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  return `v2:${shape}|${Buffer.from(rgb).toString("hex")}`;
}

const parts = (h: string) => h.replace(/^v2:/, "").split("|");

/** Bits distintos entre las formas (0 = idénticas). */
export function hashDistance(a: string, b: string): number {
  const x = parts(a)[0];
  const y = parts(b)[0];
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

/** Diferencia media (0-255) entre las miniaturas, solo donde alguna de las dos no es fondo blanco. */
export function colorDistance(a: string, b: string): number {
  const x = parts(a)[1];
  const y = parts(b)[1];
  if (!x || !y || x.length !== y.length) return 255;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < x.length; i += 6) {
    const p = [0, 2, 4].map((k) => parseInt(x.slice(i + k, i + k + 2), 16));
    const q = [0, 2, 4].map((k) => parseInt(y.slice(i + k, i + k + 2), 16));
    if (p.every((v) => v > 238) && q.every((v) => v > 238)) continue;
    sum += Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
    n += 3;
  }
  return n ? Math.round((sum / n) * 10) / 10 : 0;
}

/** La misma foto (aunque tenga otro nombre o se haya vuelto a guardar). */
export function isSamePhoto(a: string, b: string): boolean {
  if (!a.startsWith("v2:") || !b.startsWith("v2:")) return false;
  return hashDistance(a, b) <= 40 && colorDistance(a, b) <= 4;
}

export async function deleteMedia(keys: string[]): Promise<void> {
  if (keys.length) await db.delete(media).where(inArray(media.key, keys));
}

/** "/m/p/39603-abc-w1200.webp" → "p/39603-abc" */
export function mediaKeyFromUrl(url: string): string | null {
  if (!url.startsWith(MEDIA_PREFIX)) return null;
  return url.slice(MEDIA_PREFIX.length).replace(/-(w\d+\.webp|share\.jpg)$/, "");
}

const DEFERRED = "fotos-a-borrar";

/**
 * Fotos que dejaron de usarse en el deploy: se borran recién en el próximo, porque mientras se arma la
 * versión nueva la publicada todavía las muestra.
 */
export async function deferMediaDelete(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const row = await db.query.settings.findFirst({ where: eq(settings.key, DEFERRED) });
  const value = { claves: [...new Set([...(((row?.value as { claves?: string[] }) ?? {}).claves ?? []), ...keys])] };
  await db.insert(settings).values({ key: DEFERRED, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** Borra las fotos que quedaron sin usar en el deploy anterior (las que ningún producto volvió a usar). */
export async function purgeDeferredMedia(): Promise<number> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, DEFERRED) });
  const keys = ((row?.value as { claves?: string[] }) ?? {}).claves ?? [];
  if (keys.length === 0) return 0;
  const used = new Set((await db.select({ k: productImages.blobPath }).from(productImages).where(inArray(productImages.blobPath, keys))).map((r) => r.k));
  const gone = keys.filter((k) => !used.has(k));
  for (let i = 0; i < gone.length; i += 200) await db.delete(media).where(inArray(media.key, gone.slice(i, i + 200)));
  await db.delete(settings).where(eq(settings.key, DEFERRED));
  return gone.length;
}
