"use client";

import Image from "@/components/safe-image";
import Link from "next/link";
import { useState } from "react";
import { PriceText } from "@/components/wholesale";
import { displayColor, displaySize } from "@/lib/format";
import type { ClientProduct } from "@/lib/product-client";
import { useAddToCart } from "@/lib/use-add-to-cart";

function LookItem({ product }: { product: ClientProduct }) {
  const addToCart = useAddToCart();
  const available = product.variants.filter((v) => v.available);
  const [variantId, setVariantId] = useState<number | "">(available.length === 1 ? available[0].id : "");
  const [added, setAdded] = useState(false);
  const singleOption = product.variants.length === 1;

  return (
    <li className="flex gap-4 py-4" data-testid="look-item">
      <Link href={`/producto/${product.slug}`} className="relative block aspect-[3/4] w-20 shrink-0 overflow-hidden bg-soft">
        {product.image ? <Image src={product.image} alt={product.name} fill sizes="80px" className="object-cover" /> : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div>
          <Link href={`/producto/${product.slug}`} className="text-[13px] leading-snug">
            {product.name}
          </Link>
          <p className="text-[13px] tabular-nums"><PriceText productId={product.id} retail={product.price} /></p>
        </div>
        {product.soldOut ? (
          <p className="label text-mute">Sin stock</p>
        ) : (
          <div className="flex gap-2">
            {!singleOption ? (
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value ? Number(e.target.value) : "")}
                className="h-10 min-w-0 flex-1 border border-line bg-paper px-2 text-[12px] focus:border-ink focus:outline-none"
                aria-label={`Talle y color de ${product.name}`}
              >
                <option value="">Elegí talle{product.colors.length ? " y color" : ""}</option>
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id} disabled={!v.available}>
                    {displaySize(v.size)}
                    {v.color ? ` · ${displayColor(v.color)}` : ""}
                    {!v.available ? " (sin stock)" : ""}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className="btn btn-primary h-10 min-h-0 shrink-0 px-4"
              disabled={!singleOption && !variantId}
              onClick={() => {
                const id = singleOption ? product.variants[0].id : Number(variantId);
                if (!id) return;
                addToCart(product, id);
                setAdded(true);
                window.setTimeout(() => setAdded(false), 1800);
              }}
            >
              {added ? "Agregado" : "Agregar"}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export function ShopTheLook({ title, image, products }: { title: string; image: string; products: ClientProduct[] }) {
  return (
    <section className="grid gap-6 lg:grid-cols-2 lg:gap-0" aria-labelledby="look-title">
      <div className="relative aspect-[4/5] overflow-hidden bg-soft lg:aspect-auto lg:min-h-[720px]" data-reveal>
        <Image src={image} alt={title} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      </div>
      <div className="flex flex-col justify-center px-4 sm:px-8 lg:px-16" data-reveal style={{ ["--reveal-delay" as string]: "150ms" }}>
        <h2 id="look-title" className="text-[12px] font-medium uppercase tracking-[0.24em] sm:text-[13px]">
          {title}
        </h2>
        <p className="mt-2 text-[13px] text-mute">Sumá las prendas de esta foto a tu bolsa.</p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {products.map((p) => (
            <LookItem key={p.id} product={p} />
          ))}
        </ul>
      </div>
    </section>
  );
}
