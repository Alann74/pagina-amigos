import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionHeader } from "@/components/home/section-header";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductView } from "@/components/product/product-view";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { ProductSkeleton } from "@/components/skeletons";
import { getAllProductSlugs, getCatalog, getPages, getProductBySlug, getSettings } from "@/lib/catalog";
import { toEntry } from "@/lib/catalog-entry";
import { complementCategories, stablePick } from "@/lib/complements";
import { cashPrice, displayColor, formatPrice } from "@/lib/format";
import { markdownSection } from "@/lib/markdown";
import { toClientProduct } from "@/lib/product-client";
import { absoluteUrl, BRAND } from "@/lib/site";
import { shareImageUrl } from "@/lib/share-image";

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "__placeholder__" }];
}

export async function generateMetadata({ params }: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado", robots: { index: false } };
  const settings = await getSettings();
  const description = `${product.name}${product.colors.length ? ` en ${product.colors.map(displayColor).join(", ").toLowerCase()}` : ""}. ${formatPrice(product.price)} o ${formatPrice(cashPrice(product.price, settings.promo.cashDiscountPercent))} con ${settings.promo.cashDiscountPercent}% OFF en efectivo/transferencia. Pedilo por WhatsApp a INEDITA (Mitre 830, Rosario).`;
  const image = product.images[0] ? shareImageUrl(product.images[0].url) : undefined;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} · ${BRAND}`,
      description,
      url: absoluteUrl(`/producto/${product.slug}`),
      images: image ? [{ url: image, width: 1200, height: 1500, alt: product.name }] : undefined,
    },
    twitter: { card: "summary_large_image", title: product.name, description, images: image ? [image] : undefined },
  };
}

async function ProductContent({ params }: { params: PageProps<"/producto/[slug]">["params"] }) {
  const { slug } = await params;
  const [product, catalog, pages, settings] = await Promise.all([getProductBySlug(slug), getCatalog(), getPages(), getSettings()]);
  if (!product) notFound();

  const guideSource = pages.talles.body;
  const sizeGuide =
    product.sizeGuide === "unico"
      ? null
      : product.sizeGuide === "jeans"
        ? (markdownSection(guideSource, /jean/i) ?? guideSource)
        : (markdownSection(guideSource, /prendas|S ·|letras/i) ?? guideSource);

  const info = [
    ...(product.description.trim() ? [{ title: "Descripción", body: product.description }] : []),
    {
      title: "Formas de pago",
      body: `- **${settings.promo.cashDiscountPercent}% OFF** pagando en efectivo o transferencia.\n- Hasta **${settings.promo.installments} cuotas sin interés** con tarjeta.\n\nEl pago se coordina por WhatsApp cuando confirmamos tu pedido.`,
    },
    { title: "Envíos y retiro", body: pages.envios.body },
    { title: "Cambios y devoluciones", body: pages.cambios.body },
  ];

  const sameCategory = catalog.filter((p) => p.id !== product.id && p.categorySlug === product.categorySlug && !p.soldOut && p.images.length);
  const complements = catalog.filter((p) => p.id !== product.id && complementCategories(product.categorySlug).includes(p.categorySlug ?? "") && !p.soldOut && p.images.length);
  const related = [...stablePick(sameCategory, product.id, 2), ...stablePick(complements, product.id, 2)];
  const relatedFill = related.length < 4 ? stablePick(catalog.filter((p) => p.id !== product.id && !related.includes(p) && p.images.length), product.id, 4 - related.length) : [];

  const url = absoluteUrl(`/producto/${product.slug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.articleCode ?? String(product.id),
    mpn: product.articleCode ?? undefined,
    brand: { "@type": "Brand", name: BRAND },
    category: product.categoryName ?? undefined,
    image: product.images.slice(0, 6).map((i) => absoluteUrl(shareImageUrl(i.url))),
    description: product.description || `${product.name} de ${BRAND}.`,
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "ARS",
      price: product.price,
      availability: product.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: BRAND },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ProductView product={toClientProduct(product)} sizeGuide={sizeGuide} info={info} />
      {related.length + relatedFill.length > 0 ? (
        <section className="pt-8 sm:pt-16" aria-label="Productos relacionados">
          <SectionHeader title="También te puede gustar" />
          <ProductGrid products={[...related, ...relatedFill].map(toEntry)} />
        </section>
      ) : null}
      <RecentlyViewed excludeSlug={product.slug} />
    </>
  );
}

export default function ProductPage({ params }: PageProps<"/producto/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductContent params={params} />
    </Suspense>
  );
}
