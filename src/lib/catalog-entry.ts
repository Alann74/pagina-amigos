import type { CatalogProduct } from "@/lib/catalog";
import type { SearchEntry } from "@/lib/search";

/** Cuántas fotos se pueden deslizar en la tarjeta del listado (todas están en la ficha) */
export const CARD_IMAGES = 6;

export function toEntry(p: CatalogProduct): SearchEntry {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    articleCode: p.articleCode,
    category: p.categoryName,
    categorySlug: p.categorySlug,
    colors: p.colors,
    price: p.price,
    image: p.images[0]?.url ?? null,
    images: p.images.slice(0, CARD_IMAGES).map((i) => i.url),
    soldOut: p.soldOut,
    badge: p.badge,
    sizes: p.sizes,
    publishedAt: p.publishedAt,
  };
}
