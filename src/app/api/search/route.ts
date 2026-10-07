import { cacheLife, cacheTag } from "next/cache";
import { getCatalog, TAGS } from "@/lib/catalog";
import { toEntry } from "@/lib/catalog-entry";
import type { SearchEntry } from "@/lib/search";

async function buildIndex(): Promise<SearchEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog);
  const catalog = await getCatalog();
  return catalog.map(toEntry);
}

export async function GET() {
  const index = await buildIndex();
  return Response.json(index, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" },
  });
}
