"use client";

import { useMemo } from "react";
import { SectionHeader } from "@/components/home/section-header";
import { ProductCard } from "@/components/product/product-card";
import { useHydrated } from "@/lib/use-hydrated";
import { useSearchIndex } from "@/lib/use-search-index";
import { useRecent } from "@/stores/recent";

export function RecentlyViewed({ excludeSlug }: { excludeSlug?: string }) {
  const hydrated = useHydrated();
  const slugs = useRecent((s) => s.slugs);
  const wanted = hydrated ? slugs.filter((s) => s !== excludeSlug).slice(0, 4) : [];
  const index = useSearchIndex(wanted.length > 0);
  const items = useMemo(() => {
    if (!index) return [];
    const bySlug = new Map(index.map((e) => [e.slug, e]));
    return wanted.map((s) => bySlug.get(s)).filter((e): e is NonNullable<typeof e> => Boolean(e));
  }, [index, wanted]);
  if (items.length === 0) return null;
  return (
    <section className="pt-16 sm:pt-20" aria-label="Vistos recientemente">
      <SectionHeader title="Vistos recientemente" />
      <ul className="grid grid-cols-2 gap-x-1 gap-y-8 px-1 sm:gap-x-2 sm:px-2 lg:grid-cols-4 lg:gap-x-3 lg:px-3">
        {items.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
