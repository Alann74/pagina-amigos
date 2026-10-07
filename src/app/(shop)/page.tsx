import type { Metadata } from "next";
import Link from "next/link";
import { CategoryTiles, type Tile } from "@/components/home/category-tiles";
import { Hero } from "@/components/home/hero";
import { SectionHeader } from "@/components/home/section-header";
import { ShopTheLook } from "@/components/home/shop-the-look";
import { ProductGrid } from "@/components/product/product-grid";
import { getBestSellerIds, getCatalog, getCategories, getLookSettings, getProductsByIds, getSettings } from "@/lib/catalog";
import { toEntry } from "@/lib/catalog-entry";
import { stablePick } from "@/lib/complements";
import { toClientProduct } from "@/lib/product-client";
import { DEFAULT_DESCRIPTION } from "@/lib/site";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: { absolute: "INEDITA · Ropa de mujer en Rosario" },
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [settings, catalog, categories, look, bestIds] = await Promise.all([
    getSettings(),
    getCatalog(),
    getCategories(),
    getLookSettings(),
    getBestSellerIds(8),
  ]);
  const withImages = catalog.filter((p) => p.images.length > 0 && !p.soldOut);

  // Categorías destacadas (las marcadas en el admin; si no hay, las que más productos tienen)
  const featuredCats = categories.filter((c) => c.featured && c.productCount > 0);
  const catSource = (featuredCats.length >= 3 ? featuredCats : [...categories].sort((a, b) => b.productCount - a.productCount)).slice(0, 6);
  const tiles: Tile[] = catSource.map((c) => ({
    slug: c.slug,
    name: c.name,
    image: c.imageUrl ?? withImages.find((p) => p.categorySlug === c.slug)?.images[0]?.url ?? null,
  }));

  const newest = [...withImages].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 8);

  let best = (await getProductsByIds(bestIds)).filter((p) => !p.soldOut);
  if (best.length < 4) {
    const fill = withImages.filter((p) => p.featured && !best.some((b) => b.id === p.id));
    best = [...best, ...fill, ...stablePick(withImages.filter((p) => !best.some((b) => b.id === p.id)), 7, 8)].slice(0, 8);
  }
  best = best.filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i).slice(0, 8);

  const lookProducts = look.enabled ? (await getProductsByIds(look.productIds)).map(toClientProduct) : [];
  const lookImage = look.imageUrl;
  const heroFallback = [...withImages.filter((p) => p.featured), ...withImages].map((p) => p.images[0]?.url).filter((u): u is string => Boolean(u));
  const heroImages = [...new Set(heroFallback)].slice(0, 2);

  return (
    <>
      <Hero hero={settings.hero} fallbackImages={heroImages} />

      {tiles.length > 0 ? (
        <section className="pt-14 sm:pt-20" aria-label="Categorías destacadas">
          <SectionHeader title="Categorías" href="/productos" />
          <CategoryTiles tiles={tiles} />
        </section>
      ) : null}

      {newest.length > 0 ? (
        <section className="pt-16 sm:pt-24">
          <SectionHeader title="Nuevos ingresos" href="/productos?orden=nuevos" />
          <ProductGrid products={newest.map(toEntry)} testId="home-new" />
        </section>
      ) : null}

      {lookImage && lookProducts.length > 0 ? (
        <div className="pt-16 sm:pt-24">
          <ShopTheLook title={look.title} image={lookImage} products={lookProducts} />
        </div>
      ) : null}

      {best.length > 0 ? (
        <section className="pt-16 sm:pt-24">
          <SectionHeader title="Lo más pedido" href="/productos" />
          <ProductGrid products={best.map(toEntry)} testId="home-best" />
        </section>
      ) : null}

      <section className="mx-4 mt-20 grid gap-8 border-y border-line py-12 sm:mx-8 sm:mt-28 md:grid-cols-3" aria-label="Información">
        <div>
          <p className="label font-medium">Pedí por WhatsApp</p>
          <p className="mt-2 text-[13px] text-mute">Armá tu bolsa y enviá el pedido. Te respondemos para confirmar talle, pago y entrega.</p>
        </div>
        <div>
          <p className="label font-medium">{settings.promo.cashDiscountPercent}% OFF efectivo o transferencia</p>
          <p className="mt-2 text-[13px] text-mute">O hasta {settings.promo.installments} cuotas sin interés con tarjeta.</p>
        </div>
        <div>
          <p className="label font-medium">Visitanos</p>
          <p className="mt-2 text-[13px] text-mute">
            {settings.address}. {settings.storeHours[0] ? `${settings.storeHours[0].days}, ${settings.storeHours[0].hours}.` : ""}{" "}
            <Link href="/contacto" className="underline underline-offset-4">
              Cómo llegar
            </Link>
          </p>
        </div>
        <a href={whatsappUrl(settings.whatsappNumber, "Hola INEDITA! Tengo una consulta.")} className="sr-only" target="_blank" rel="noopener">
          WhatsApp
        </a>
      </section>
    </>
  );
}
