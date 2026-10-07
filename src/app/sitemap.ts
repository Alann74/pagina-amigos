import type { MetadataRoute } from "next";
import { getCatalog, getCategories } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/site";
import { PAGE_ROUTES } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, categories] = await Promise.all([getCatalog(), getCategories()]);
  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/productos"), changeFrequency: "daily", priority: 0.9 },
    ...categories.filter((c) => c.productCount > 0).map((c) => ({ url: absoluteUrl(`/categoria/${c.slug}`), changeFrequency: "daily" as const, priority: 0.8 })),
    ...catalog.map((p) => ({
      url: absoluteUrl(`/producto/${p.slug}`),
      lastModified: p.publishedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: p.images.slice(0, 1).map((i) => absoluteUrl(i.url)),
    })),
    ...Object.values(PAGE_ROUTES).map((path) => ({ url: absoluteUrl(path), changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
