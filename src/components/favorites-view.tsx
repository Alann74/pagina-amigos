"use client";

import Link from "next/link";
import { useMemo } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { PageTitle } from "@/components/page-title";
import { ProductCard } from "@/components/product/product-card";
import { useShopConfig } from "@/components/shop-config";
import { trackContactWhatsapp } from "@/lib/analytics";
import { useHydrated } from "@/lib/use-hydrated";
import { useSearchIndex } from "@/lib/use-search-index";
import { favoritesMessage, whatsappUrl } from "@/lib/whatsapp";
import { useFavorites } from "@/stores/favorites";

export function FavoritesView() {
  const hydrated = useHydrated();
  const favorites = useFavorites((s) => s.items);
  const { whatsappNumber, siteUrl } = useShopConfig();
  const index = useSearchIndex(hydrated && favorites.length > 0);

  const entries = useMemo(() => {
    if (!index) return [];
    const bySlug = new Map(index.map((e) => [e.id, e]));
    return favorites.map((f) => bySlug.get(f.productId)).filter((e): e is NonNullable<typeof e> => Boolean(e));
  }, [index, favorites]);

  if (!hydrated) return <div className="min-h-[50vh]" aria-busy />;

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 px-6 py-24 text-center">
        <h1 className="text-[13px] font-medium uppercase tracking-[0.24em]">Favoritos</h1>
        <p className="max-w-sm text-sm text-mute">Tocá el corazón en cualquier producto para guardarlo acá y consultarlos todos juntos por WhatsApp.</p>
        <Link href="/productos" className="btn btn-primary">
          Ver colección
        </Link>
      </div>
    );
  }

  const list = entries.length ? entries : [];
  const href = whatsappUrl(
    whatsappNumber,
    favoritesMessage(favorites.map((f) => ({ name: f.name, url: `${siteUrl}/producto/${f.slug}` }))),
  );

  return (
    <>
      <PageTitle title={`Favoritos (${favorites.length})`} />
      <div className="px-4 pb-8 sm:px-8">
        <a href={href} target="_blank" rel="noopener" className="btn btn-primary w-full sm:w-auto" onClick={() => trackContactWhatsapp("favoritos")} data-testid="favorites-whatsapp">
          <WhatsAppIcon size={16} /> Consultar todos por WhatsApp
        </a>
      </div>
      <ul className="grid grid-cols-2 gap-x-1 gap-y-8 px-1 sm:gap-x-2 sm:px-2 lg:grid-cols-4 lg:gap-x-3 lg:px-3">
        {list.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
    </>
  );
}
