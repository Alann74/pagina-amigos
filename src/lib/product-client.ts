// Forma liviana de un producto con variantes, para componentes de cliente (ficha, comprá el look).
import type { CatalogProduct } from "@/lib/catalog";

export type ClientProduct = {
  id: number;
  slug: string;
  name: string;
  articleCode: string | null;
  price: number;
  compareAtPrice: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  image: string | null;
  images: { url: string; alt: string; color: string | null }[];
  sizes: string[];
  colors: string[];
  variants: { id: number; size: string; color: string | null; price: number; available: boolean; sku: string }[];
  soldOut: boolean;
};

export function toClientProduct(p: CatalogProduct): ClientProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    articleCode: p.articleCode,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    categoryName: p.categoryName,
    categorySlug: p.categorySlug,
    image: p.images[0]?.url ?? null,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt, color: i.color })),
    sizes: p.sizes,
    colors: p.colors,
    variants: p.variants.map((v) => ({ id: v.id, size: v.size, color: v.color, price: v.price, available: v.available, sku: v.sku })),
    soldOut: p.soldOut,
  };
}
