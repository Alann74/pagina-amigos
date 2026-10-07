import { cacheLife, cacheTag } from "next/cache";
import { getCatalog, TAGS } from "@/lib/catalog";
import type { SearchEntry } from "@/lib/search";

async function buildIndex(): Promise<SearchEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  const catalog = await getCatalog();
  return catalog.map((p) => ({
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
  }));
}

export async function GET() {
  const index = await buildIndex();
  return Response.json(index, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" },
  });
}
