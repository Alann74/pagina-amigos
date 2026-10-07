import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/db";
import { colors, productImages, products } from "@/db/schema";
import { isAdmin } from "@/lib/admin-guard";
import { TAGS } from "@/lib/catalog";
import { slugify } from "@/lib/format";
import { imageRatio, processCampaignImage, processProductImage } from "@/lib/images";

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

    // Subida masiva (fotos de Drive bajadas a la compu): se identifica cada foto para no duplicarla
    const driveFileId = form.get("driveFileId") ? String(form.get("driveFileId")).slice(0, 100) : null;
    if (driveFileId) {
      const dup = await db.query.productImages.findFirst({ where: and(eq(productImages.productId, product.id), eq(productImages.driveFileId, driveFileId)) });
      if (dup) return Response.json({ ok: true, skipped: true, image: dup });
    } else if (form.get("dedupe") === "1" && sourceName) {
      const dup = await db.query.productImages.findFirst({ where: and(eq(productImages.productId, product.id), eq(productImages.sourceName, sourceName)) });
      if (dup) return Response.json({ ok: true, skipped: true, image: dup });
    }

    let colorId: number | null = null;
    const colorIdRaw = form.get("colorId");
    if (colorIdRaw && /^\d+$/.test(String(colorIdRaw))) colorId = Number(colorIdRaw);
    const colorName = form.get("colorName") ? String(form.get("colorName")).toUpperCase() : null;
    if (!colorId && colorName) colorId = (await db.query.colors.findFirst({ where: eq(colors.name, colorName) }))?.id ?? null;

    // Fotos de campaña con proporción parecida a 3:4 se recortan desde arriba; las de catálogo van enteras
    const photoKind = form.get("photoKind") ? String(form.get("photoKind")) : "catalogo";
    const ratio = photoKind !== "catalogo" ? await imageRatio(buffer) : null;
    const fit = ratio !== null && ratio >= 1.2 && ratio <= 1.55 ? "cover" : "contain";

    const base = driveFileId ? `p/${product.articleCode ?? `id${product.id}`}-${driveFileId.slice(0, 12)}` : `p/${product.articleCode ?? `id${product.id}`}-${stamp}`;
    const img = await processProductImage(buffer, base, { fit });
    const sortRaw = form.get("sortOrder");
    const sortOrder =
      sortRaw && /^\d+$/.test(String(sortRaw))
        ? Number(sortRaw)
        : (
            await db
              .select({ next: sql<number>`coalesce(max(${productImages.sortOrder}) + 1, 0)`.mapWith(Number) })
              .from(productImages)
              .where(eq(productImages.productId, product.id))
          )[0].next;
    const [row] = await db
      .insert(productImages)
      .values({ productId: product.id, url: img.url, blobPath: base, alt: product.name, colorId, sortOrder, width: img.width, height: img.height, sourceName, driveFileId })
      .onConflictDoNothing()
      .returning();
    // Foto subida a mano (no de Drive): queda donde la pusieron, el deploy no reordena este producto
    if (!driveFileId) {
      const { markManualOrder } = await import("@/lib/photo-order");
      await markManualOrder(product.id);
    }
    revalidateTag(TAGS.catalog, { expire: 0 });
    return Response.json({ ok: true, image: row });
  } catch (error) {
    console.error("[upload]", error);
    return Response.json({ error: "No se pudo procesar la foto" }, { status: 500 });
  }
}
