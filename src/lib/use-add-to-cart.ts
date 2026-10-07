"use client";

import { trackAddToCart } from "@/lib/analytics";
import type { ClientProduct } from "@/lib/product-client";
import { useCart } from "@/stores/cart";

export function useAddToCart() {
  const add = useCart((s) => s.add);
  return (product: ClientProduct, variantId: number, quantity = 1) => {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) return;
    const colorImage = variant.color ? product.images.find((i) => i.color === variant.color)?.url : null;
    add(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        articleCode: product.articleCode,
        size: variant.size,
        color: variant.color,
        price: variant.price,
        image: product.image ?? colorImage ?? null,
        options: product.variants.map((v) => ({ variantId: v.id, size: v.size, color: v.color, price: v.price, available: v.available })),
      },
      quantity,
    );
    trackAddToCart({ id: product.articleCode ?? String(product.id), name: product.name, price: variant.price, quantity, category: product.categoryName });
  };
}
