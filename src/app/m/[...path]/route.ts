import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { media } from "@/db/schema";

// Fotos guardadas en la base: /m/<clave>-w800.webp (cualquier ancho de 200 a 2400) o /m/<clave>-share.jpg.
// Cada versión se genera una vez y queda en la caché del navegador y de Vercel por un año (la clave
// cambia si cambia la foto), así casi nunca se vuelve a la base.

const LONG_CACHE = "public, max-age=31536000, immutable";

export async function GET(_request: Request, ctx: RouteContext<"/m/[...path]">) {
  const { path } = await ctx.params;
  const name = path.join("/");
  const match = name.match(/^(.+?)-(?:w(\d{3,4})\.webp|(share)\.jpg)$/);
  if (!match) return new Response("No encontrado", { status: 404 });
  const [, key, w, share] = match;
  const row = await db.query.media.findFirst({ where: eq(media.key, key) });
  if (!row) return new Response("No encontrado", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

  const source = sharp(row.data, { failOn: "none" });
  let body: Buffer;
  let type: string;
  if (share) {
    // JPG para compartir y como respaldo en equipos sin WebP: 1200 de ancho (productos en 4:5)
    const product = key.startsWith("p/");
    body = await (product ? source.resize(1200, 1500, { fit: "cover", position: "top" }) : source.resize({ width: 1200, withoutEnlargement: true }))
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    type = "image/jpeg";
  } else {
    const width = Math.min(Math.max(Number(w), 200), 2400);
    body = width >= row.width ? row.data : await source.resize({ width }).webp({ quality: width >= 1200 ? 82 : 78, effort: 4 }).toBuffer();
    type = "image/webp";
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(body.length),
      "Cache-Control": LONG_CACHE,
      "CDN-Cache-Control": LONG_CACHE,
      "Vercel-CDN-Cache-Control": LONG_CACHE,
    },
  });
}
