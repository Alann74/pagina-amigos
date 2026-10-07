import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/db";
import { productImages, products } from "@/db/schema";
import { isAdmin } from "@/lib/admin-guard";
import { TAGS } from "@/lib/catalog";
import { slugify } from "@/lib/format";
import { processCampaignImage, processProductImage } from "@/lib/images";

export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // el navegador achica la foto antes de subirla

// Sube una foto: kind=product la agrega al producto (3 tamaños WebP + JPG para compartir);
// kind=campaign devuelve la URL para portada, look o categorías.
export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof Blob)) return Response.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "La foto es demasiado pesada (máx. 4 MB)" }, { status: 413 });
  if (!/^image\//.test(file.type)) return Response.json({ error: "El archivo tiene que ser una imagen" }, { status: 415 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = String(form.get("kind") ?? "product");
  const stamp = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const sourceName = file instanceof File ? file.name : null;

  try {
    if (kind === "campaign") {
      const name = slugify(String(form.get("name") ?? "campana")) || "campana";
      const img = await processCampaignImage(buffer, `c/${name}-${stamp}`);
      return Response.json({ ok: true, url: img.url, width: img.width, height: img.height });
    }

    const productId = Number(form.get("productId"));
    const product = Number.isInteger(productId) ? await db.query.products.findFirst({ where: eq(products.id, productId) }) : null;
    if (!product) return Response.json({ error: "Producto inexistente" }, { status: 404 });
    const colorIdRaw = form.get("colorId");
    const colorId = colorIdRaw && /^\d+$/.test(String(colorIdRaw)) ? Number(colorIdRaw) : null;
    const base = `p/${product.articleCode ?? `id${product.id}`}-${stamp}`;
    const img = await processProductImage(buffer, base);
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${productImages.sortOrder}) + 1, 0)`.mapWith(Number) })
      .from(productImages)
      .where(eq(productImages.productId, product.id));
    const [row] = await db
      .insert(productImages)
      .values({ productId: product.id, url: img.url, blobPath: base, alt: product.name, colorId, sortOrder: next, width: img.width, height: img.height, sourceName })
      .returning();
    revalidateTag(TAGS.catalog, { expire: 0 });
    return Response.json({ ok: true, image: row });
  } catch (error) {
    console.error("[upload]", error);
    return Response.json({ error: "No se pudo procesar la foto" }, { status: 500 });
  }
}
