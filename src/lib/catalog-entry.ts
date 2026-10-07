import type { CatalogProduct } from "@/lib/catalog";
import type { SearchEntry } from "@/lib/search";

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
    hoverImage: p.images[1]?.url ?? null,
    soldOut: p.soldOut,
    badge: p.badge,
    sizes: p.sizes,
    publishedAt: p.publishedAt,
  };
}
