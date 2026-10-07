"use client";

import Image from "next/image";
import Link from "next/link";
import { FavoriteButton } from "@/components/product/favorite-button";
import { useShopConfig } from "@/components/shop-config";
import { cashPrice, formatPrice } from "@/lib/format";
import type { SearchEntry } from "@/lib/search";

const BADGE_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  ultimas: "Últimas unidades",
  "sin-stock": "Sin stock",
};

export function ProductCard({ product, priority = false, sizes = "(min-width: 1024px) 25vw, 50vw" }: { product: SearchEntry; priority?: boolean; sizes?: string }) {
  const { cashDiscountPercent } = useShopConfig();
  const badge = product.badge ? BADGE_LABEL[product.badge] : null;
  return (
    <article className="group relative" data-testid="product-card">
      <Link href={`/producto/${product.slug}`} className="block" aria-label={`${product.name}, ${formatPrice(product.price)}`}>
        <div className="relative aspect-[3/4] overflow-hidden bg-soft">
          {product.image ? (
            <>
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes={sizes}
                priority={priority}
                className={`object-cover transition-opacity duration-500 ${product.hoverImage ? "lg:group-hover:opacity-0" : ""} ${product.soldOut ? "opacity-60" : ""}`}
              />
              {product.hoverImage ? (
                <Image
                  src={product.hoverImage}
                  alt=""
                  aria-hidden
                  fill
                  sizes={sizes}
                  className="hidden object-cover opacity-0 transition-opacity duration-500 lg:block lg:group-hover:opacity-100"
                />
              ) : null}
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="pl-[0.32em] text-[11px] tracking-[0.32em] text-faint">INEDITA</span>
            </div>
          )}
          {badge ? (
            <span
              className={`label absolute left-2 top-2 px-1.5 py-0.5 text-[9.5px] sm:left-3 sm:top-3 sm:text-[10px] ${
                product.badge === "sin-stock" ? "bg-paper text-mute" : "bg-paper text-ink"
              }`}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 px-0.5 sm:mt-3">
          <h3 className="text-[12.5px] leading-snug sm:text-[13px]">{product.name}</h3>
          <p className="mt-0.5 text-[12.5px] tabular-nums sm:text-[13px]">{formatPrice(product.price)}</p>
          {cashDiscountPercent > 0 ? (
            <p className="mt-0.5 text-[11px] leading-snug text-mute tabular-nums">
              {formatPrice(cashPrice(product.price, cashDiscountPercent))} con {cashDiscountPercent}% OFF efectivo/transferencia
            </p>
          ) : null}
        </div>
      </Link>
      <FavoriteButton
        item={{ productId: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image }}
        className="absolute right-0.5 top-0.5 h-10 w-10 sm:right-1.5 sm:top-1.5"
        size={17}
      />
    </article>
  );
}
