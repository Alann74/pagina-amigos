import fs from "node:fs/promises";
import path from "node:path";

// Si hay BLOB_READ_WRITE_TOKEN se sube a Vercel Blob; si no (desarrollo local) se guarda en /public/uploads.
export async function putFile(pathname: string, body: Buffer, contentType: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
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
  if (process.env.BLOB_READ_WRITE_TOKEN) {
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
