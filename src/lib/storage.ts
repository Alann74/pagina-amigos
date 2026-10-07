import fs from "node:fs/promises";
import path from "node:path";

/**
 * Vercel Blob conectado: con el token clásico (BLOB_READ_WRITE_TOKEN) o con la conexión nueva de Vercel
 * (BLOB_STORE_ID + autenticación automática OIDC). Sin ninguno (desarrollo local) se guarda en /public/uploads.
 */
export function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function putFile(pathname: string, body: Buffer, contentType: string): Promise<string> {
  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    const result = await put(pathname, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return result.url;
  }
  const target = path.join(process.cwd(), "public", "uploads", pathname);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body);
  return `/uploads/${pathname}`;
}

export async function deleteFiles(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  // Fotos guardadas en la base
  const { deleteMedia, mediaKeyFromUrl } = await import("@/lib/media");
  const keys = [...new Set(urls.map(mediaKeyFromUrl).filter((k): k is string => Boolean(k)))];
  await deleteMedia(keys);
  urls = urls.filter((u) => !mediaKeyFromUrl(u));
  if (urls.length === 0) return;
  if (blobEnabled()) {
    const { del } = await import("@vercel/blob");
    await del(urls.filter((u) => u.startsWith("http")));
    return;
  }
  await Promise.all(
    urls
      .filter((u) => u.startsWith("/uploads/"))
      .map((u) => fs.rm(path.join(process.cwd(), "public", u), { force: true })),
  );
}
