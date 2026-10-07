"use client";

import Image from "@/components/safe-image";
import Link from "next/link";
import { useRef, useState } from "react";
import { ChevronDown } from "@/components/icons";
import { FavoriteButton } from "@/components/product/favorite-button";
import { useShopConfig } from "@/components/shop-config";
import { useWholesale } from "@/components/wholesale";
import { cashPrice, formatPrice } from "@/lib/format";
import type { SearchEntry } from "@/lib/search";

const BADGE_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  ultimas: "Últimas unidades",
  "sin-stock": "Sin stock",
};

export function ProductCard({ product, priority = false, sizes = "(min-width: 1024px) 25vw, 50vw" }: { product: SearchEntry; priority?: boolean; sizes?: string }) {
  const { cashDiscountPercent: retailCashPercent } = useShopConfig();
  const wholesale = useWholesale();
  const price = wholesale.priceFor(product.id, product.price);
  const cashDiscountPercent = wholesale.active ? (wholesale.session?.cashDiscountPercent ?? 0) : retailCashPercent;
  const badge = product.badge ? BADGE_LABEL[product.badge] : null;
  const href = `/producto/${product.slug}`;
  // Entradas viejas guardadas en el navegador (favoritos, vistos) pueden no traer la lista
  const images = product.images?.length ? product.images : product.image ? [product.image] : [];
  return (
    <article className="group relative" data-testid="product-card">
      <div className="relative aspect-[3/4] overflow-hidden bg-soft">
        {images.length ? (
          <CardCarousel images={images} href={href} name={product.name} sizes={sizes} priority={priority} dim={product.soldOut} />
        ) : (
          <Link href={href} tabIndex={-1} aria-hidden className="flex h-full items-center justify-center">
            <span className="pl-[0.32em] text-[11px] tracking-[0.32em] text-faint">INEDITA</span>
          </Link>
        )}
        {badge ? (
          <span
            className={`label pointer-events-none absolute left-2 top-2 px-1.5 py-0.5 text-[9.5px] sm:left-3 sm:top-3 sm:text-[10px] ${
              product.badge === "sin-stock" ? "bg-paper text-mute" : "bg-paper text-ink"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <Link href={href} className="mt-2.5 block px-0.5 sm:mt-3" aria-label={`${product.name}, ${formatPrice(price)}`}>
        <h3 className="text-[12.5px] leading-snug sm:text-[13px]">{product.name}</h3>
        <p className="mt-0.5 flex items-baseline justify-between gap-2 text-[12.5px] tabular-nums sm:text-[13px]">
          <span data-price>{formatPrice(price)}</span>
          {product.colors.length > 1 ? <span className="shrink-0 text-[11.5px] text-mute">{product.colors.length} colores</span> : null}
        </p>
        {wholesale.active ? (
          <p className="mt-1 text-[12px] leading-snug text-mute">{wholesale.hasWholesalePrice(product.id) ? "Precio por mayor" : "Precio de tienda"}</p>
        ) : null}
        {cashDiscountPercent > 0 ? (
          <p className="mt-1 text-[12px] leading-snug text-mute tabular-nums">
            <span className="font-medium text-ink" data-price>
              {formatPrice(cashPrice(price, cashDiscountPercent))}
            </span> con {cashDiscountPercent}% OFF efectivo/transferencia
          </p>
        ) : null}
      </Link>
      <FavoriteButton
        item={{ productId: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image }}
        className="absolute right-0.5 top-0.5 h-10 w-10 sm:right-1.5 sm:top-1.5"
        size={17}
      />
    </article>
  );
}

/**
 * Fotos del producto para deslizar en el listado: en el celular con el dedo (con puntos abajo), en la
 * compu con las flechas que aparecen al pasar el mouse. Tocar la foto lleva a la ficha.
 * Al principio se cargan la primera y la segunda; las demás, cuando se empieza a deslizar.
 */
function CardCarousel({ images, href, name, sizes, priority, dim }: { images: string[]; href: string; name: string; sizes: string; priority: boolean; dim: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const many = images.length > 1;

  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    if (!engaged) setEngaged(true);
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(Math.max(0, Math.min(images.length - 1, i)));
  };
  const go = (delta: number) => {
    const el = track.current;
    if (!el) return;
    setEngaged(true);
    const next = (active + delta + images.length) % images.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    <>
      <div
        ref={track}
        onScroll={many ? onScroll : undefined}
        onPointerEnter={many ? () => setEngaged(true) : undefined}
        className={`flex h-full ${many ? "scrollbar-none snap-x snap-mandatory overflow-x-auto overscroll-x-contain" : ""}`}
        data-testid="card-carousel"
      >
        {images.map((src, i) => (
          <Link key={`${src}-${i}`} href={href} tabIndex={-1} aria-hidden className="relative block h-full w-full shrink-0 snap-start snap-always" draggable={false}>
            {i <= 1 || engaged ? (
              <Image
                src={src}
                alt={i === 0 ? name : ""}
                fill
                sizes={sizes}
                priority={priority && i === 0}
                draggable={false}
                className={`select-none object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:group-hover:scale-[1.04] ${dim ? "opacity-60" : ""}`}
              />
            ) : null}
          </Link>
        ))}
      </div>
      {many ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center" aria-hidden>
            <div className="flex gap-1.5 rounded-full bg-paper/75 px-2 py-1.5" data-testid="card-dots">
              {images.map((src, i) => (
                <span key={`${src}-${i}`} className={`h-[5px] w-[5px] rounded-full transition-colors ${i === active ? "bg-ink" : "bg-ink/25"}`} />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-1.5 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center bg-paper/85 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 lg:flex"
            aria-label={`Foto anterior de ${name}`}
          >
            <ChevronDown size={16} className="rotate-90" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-1.5 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center bg-paper/85 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 lg:flex"
            aria-label={`Foto siguiente de ${name}`}
          >
            <ChevronDown size={16} className="-rotate-90" />
          </button>
        </>
      ) : null}
    </>
  );
}
