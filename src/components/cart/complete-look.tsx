"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { complementCategories, stablePick } from "@/lib/complements";
import { formatPrice } from "@/lib/format";
import { useSearchIndex } from "@/lib/use-search-index";
import type { CartItem } from "@/stores/cart";

export function CompleteLook({ items, onNavigate }: { items: CartItem[]; onNavigate?: () => void }) {
  const index = useSearchIndex(items.length > 0);
  const picks = useMemo(() => {
    if (!index || items.length === 0) return [];
    const inCart = new Set(items.map((i) => i.productId));
    const cartCats = new Set(index.filter((e) => inCart.has(e.id)).map((e) => e.categorySlug));
    const wanted = new Set([...cartCats].flatMap((c) => complementCategories(c ?? null)));
    const pool = index.filter((e) => !inCart.has(e.id) && !e.soldOut && e.image && wanted.has(e.categorySlug ?? "") && !cartCats.has(e.categorySlug));
    const seed = items.reduce((acc, i) => acc + i.productId, 0);
    return stablePick(pool, seed, 3);
  }, [index, items]);

  if (picks.length === 0) return null;
  return (
    <section className="border-t border-line px-5 py-6" aria-labelledby="complete-look-title">
      <h3 id="complete-look-title" className="label font-medium">
        Completá tu look
      </h3>
      <ul className="mt-4 grid grid-cols-3 gap-2">
        {picks.map((p) => (
          <li key={p.id}>
            <Link href={`/producto/${p.slug}`} onClick={onNavigate} className="block">
              <div className="relative aspect-[3/4] overflow-hidden bg-soft">
                {p.image ? <Image src={p.image} alt={p.name} fill sizes="140px" className="object-cover" /> : null}
              </div>
              <p className="mt-2 line-clamp-2 text-[12px] leading-snug">{p.name}</p>
              <p className="text-[12px] tabular-nums text-mute">{formatPrice(p.price)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
