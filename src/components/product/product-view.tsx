"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MinusIcon, PlusIcon, ShareIcon, WhatsAppIcon } from "@/components/icons";
import { Drawer } from "@/components/layout/drawer";
import { FavoriteButton } from "@/components/product/favorite-button";
import { Gallery } from "@/components/product/gallery";
import { useShopConfig } from "@/components/shop-config";
import { useWholesale } from "@/components/wholesale";
import { trackContactWhatsapp, trackViewProduct } from "@/lib/analytics";
import { cashPrice, displayColor, displaySize, formatPrice } from "@/lib/format";
import { Markdown } from "@/lib/markdown";
import type { ClientProduct } from "@/lib/product-client";
import { useAddToCart } from "@/lib/use-add-to-cart";
import { notifyMeMessage, productConsultMessage, variantDetail, whatsappUrl } from "@/lib/whatsapp";
import { MAX_QTY } from "@/stores/cart";
import { useRecent } from "@/stores/recent";

type InfoBlock = { title: string; body: string };

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group border-b border-line" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 [&::-webkit-details-marker]:hidden">
        <span className="nav-link">{title}</span>
        <ChevronDown size={16} className="transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="pb-5 text-[13px] leading-relaxed">{children}</div>
    </details>
  );
}

export function ProductView({
  product,
  sizeGuide,
  info,
}: {
  product: ClientProduct;
  sizeGuide: string | null;
  info: InfoBlock[];
}) {
  const { whatsappNumber, cashDiscountPercent: retailCashPercent, installments: retailInstallments, siteUrl } = useShopConfig();
  const wholesale = useWholesale();
  const cashDiscountPercent = wholesale.active ? (wholesale.session?.cashDiscountPercent ?? 0) : retailCashPercent;
  const installments = wholesale.active ? 1 : retailInstallments;
  const addToCart = useAddToCart();
  const pushRecent = useRecent((s) => s.push);
  const sizesRef = useRef<HTMLFieldSetElement>(null);

  const hasColors = product.colors.length > 0;
  const firstAvailable = product.variants.find((v) => v.available);
  const [color, setColor] = useState<string | null>(hasColors ? (firstAvailable?.color ?? product.colors[0]) : null);
  const onlySize = product.sizes.length === 1 ? product.sizes[0] : null;
  const [size, setSize] = useState<string | null>(onlySize);
  const [quantity, setQuantity] = useState(1);
  const [needSize, setNeedSize] = useState(false);
  const [added, setAdded] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    pushRecent(product.slug);
    trackViewProduct({ id: product.articleCode ?? String(product.id), name: product.name, price: product.price, category: product.categoryName });
  }, [product.slug, product.articleCode, product.id, product.name, product.price, product.categoryName, pushRecent]);

  const variantFor = (s: string | null, c: string | null) => product.variants.find((v) => v.size === s && (hasColors ? v.color === c : true));
  const selected = size ? variantFor(size, color) : undefined;
  const sizeAvailable = (s: string) => product.variants.some((v) => v.size === s && (hasColors ? v.color === color : true) && v.available);
  const colorAvailable = (c: string) => product.variants.some((v) => v.color === c && v.available);
  const price = wholesale.priceFor(product.id, selected?.price ?? product.price);
  const outOfStock = selected ? !selected.available : product.soldOut;

  const images = useMemo(() => {
    if (!color) return product.images;
    const forColor = product.images.filter((i) => i.color === color);
    if (forColor.length === 0) return product.images;
    const general = product.images.filter((i) => !i.color);
    const rest = product.images.filter((i) => i.color && i.color !== color);
    // Primero las fotos con modelo (generales), después la prenda en el color elegido
    return [...general, ...forColor, ...rest];
  }, [color, product.images]);

  const productUrl = `${siteUrl}/producto/${product.slug}`;
  const detail = variantDetail(size, color);
  const consultHref = whatsappUrl(whatsappNumber, productConsultMessage(product.name, detail, productUrl));
  const notifyHref = whatsappUrl(whatsappNumber, notifyMeMessage(product.name, detail, productUrl));

  const handleAdd = () => {
    if (!size || !selected) {
      setNeedSize(true);
      sizesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!selected.available) return;
    addToCart(product, selected.id, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  };

  const share = async () => {
    const data = { title: `${product.name} · INEDITA`, text: `Mirá ${product.name} en INEDITA`, url: productUrl };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(productUrl);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      // el usuario canceló
    }
  };

  const ctaLabel = added ? "Agregado a tu bolsa" : outOfStock && size ? "Sin stock en este talle" : "Agregar al carrito";

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)] lg:gap-10 lg:px-3 xl:gap-16">
      <div>
        <Gallery images={images.map((i) => ({ url: i.url, alt: i.alt || product.name }))} name={product.name} />
      </div>

      <div className="px-4 pb-32 pt-6 sm:px-8 lg:px-0 lg:pb-16 lg:pt-10">
        <div className="lg:sticky lg:top-24">
          <nav aria-label="Ruta" className="label mb-4 hidden text-mute lg:block">
            <Link href="/productos" className="hover:text-ink">
              Tienda
            </Link>
            {product.categorySlug ? (
              <>
                {" / "}
                <Link href={`/categoria/${product.categorySlug}`} className="hover:text-ink">
                  {product.categoryName}
                </Link>
              </>
            ) : null}
          </nav>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-[17px] font-normal leading-snug sm:text-[19px]" data-testid="product-name">
              {product.name}
            </h1>
            <div className="-mr-2 -mt-2 flex shrink-0">
              <button type="button" onClick={share} className="flex h-10 w-10 items-center justify-center" aria-label="Compartir">
                <ShareIcon size={18} />
              </button>
              <FavoriteButton
                item={{ productId: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image }}
                className="h-10 w-10"
              />
            </div>
          </div>
          {shared ? <p className="label mt-1 text-mute">Link copiado</p> : null}
          {product.articleCode ? <p className="mt-1 text-[11px] text-mute">Art. {product.articleCode}</p> : null}

          <div className="mt-4 space-y-1">
            <p className="text-[17px] tabular-nums" data-testid="product-price" data-price>
              {formatPrice(price)}
              {!wholesale.active && product.compareAtPrice && product.compareAtPrice > price ? (
                <span className="ml-2 text-[13px] text-mute line-through">{formatPrice(product.compareAtPrice)}</span>
              ) : null}
            </p>
            {wholesale.active ? (
              <p className="label text-mute">{wholesale.hasWholesalePrice(product.id) ? "Precio por mayor" : "Precio de tienda"}</p>
            ) : null}
            {cashDiscountPercent > 0 ? (
              <p className="text-[13px] tabular-nums" data-price>
                <strong className="font-medium">{formatPrice(cashPrice(price, cashDiscountPercent))}</strong> con {cashDiscountPercent}% OFF efectivo/transferencia
              </p>
            ) : null}
            {installments > 1 ? (
              <p className="text-[12px] text-mute tabular-nums" data-price>
                o {installments} cuotas sin interés de {formatPrice(Math.ceil(price / installments))}
              </p>
            ) : null}
          </div>

          {hasColors ? (
            <fieldset className="mt-8">
              <legend className="label">
                Color: <span className="text-mute">{displayColor(color)}</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.colors.map((c) => {
                  const on = c === color;
                  const available = colorAvailable(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setColor(c);
                        if (size && !product.variants.some((v) => v.size === size && v.color === c)) setSize(onlySize);
                      }}
                      className={`h-10 border px-3 text-[12px] transition-colors ${on ? "border-ink" : "border-line hover:border-ink"} ${available ? "" : "text-faint line-through"}`}
                      data-testid="color-option"
                    >
                      {displayColor(c)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <fieldset className="mt-7" ref={sizesRef}>
            <div className="flex items-center justify-between">
              <legend className="label">
                Talle{size ? <span className="text-mute">: {displaySize(size)}</span> : null}
              </legend>
              {sizeGuide ? (
                <button type="button" onClick={() => setGuideOpen(true)} className="label underline underline-offset-4">
                  Guía de talles
                </button>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.sizes.map((s) => {
                const on = s === size;
                const available = sizeAvailable(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Talle ${displaySize(s)}${available ? "" : " (sin stock)"}`}
                    onClick={() => {
                      setSize(s);
                      setNeedSize(false);
                    }}
                    className={`relative h-11 min-w-12 border px-3 text-[13px] transition-colors ${
                      on ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                    } ${available ? "" : on ? "bg-mute border-mute" : "text-faint"}`}
                    data-testid="size-option"
                  >
                    {displaySize(s)}
                    {!available ? <span className="absolute left-1 right-1 top-1/2 h-px -rotate-[20deg] bg-current opacity-60" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
            {needSize ? (
              <p className="mt-2 text-[12px]" role="alert">
                Elegí un talle para agregarlo a tu bolsa.
              </p>
            ) : null}
          </fieldset>

          {!outOfStock ? (
            <div className="mt-7 flex items-center gap-4">
              <span className="label">Cantidad</span>
              <div className="flex h-10 items-center border border-line" role="group" aria-label="Cantidad">
                <button type="button" className="flex h-full w-10 items-center justify-center" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Restar">
                  <MinusIcon size={14} />
                </button>
                <span className="w-8 text-center text-[13px] tabular-nums" aria-live="polite">
                  {quantity}
                </span>
                <button type="button" className="flex h-full w-10 items-center justify-center" onClick={() => setQuantity((q) => Math.min(MAX_QTY, q + 1))} aria-label="Sumar">
                  <PlusIcon size={14} />
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-8 space-y-3">
            {outOfStock && size ? (
              <a
                href={notifyHref}
                target="_blank"
                rel="noopener"
                onClick={() => trackContactWhatsapp("avisame")}
                className="btn btn-primary w-full"
                data-testid="notify-me"
              >
                Avisame cuando vuelva
              </a>
            ) : (
              <button type="button" onClick={handleAdd} className="btn btn-primary hidden w-full lg:flex" data-testid="add-to-cart-desktop">
                {ctaLabel}
              </button>
            )}
            <a
              href={consultHref}
              target="_blank"
              rel="noopener"
              onClick={() => trackContactWhatsapp("ficha")}
              className="btn btn-secondary w-full"
              data-testid="consult-whatsapp"
            >
              <WhatsAppIcon size={16} /> Consultar por WhatsApp
            </a>
          </div>

          <div className="mt-10 border-t border-line">
            {info.map((block, i) => (
              <Accordion key={block.title} title={block.title} defaultOpen={i === 0 && block.title === "Descripción"}>
                <Markdown source={block.body} className="prose-inedita [&_p]:text-[13px] [&_li]:text-[13px] [&_h2]:mt-4" />
              </Accordion>
            ))}
          </div>
        </div>
      </div>

      {/* Botón fijo abajo en mobile */}
      {!(outOfStock && size) ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <button type="button" onClick={handleAdd} className="btn btn-primary w-full" data-testid="add-to-cart">
            {ctaLabel}
            {!added ? <span className="font-normal tabular-nums opacity-80" data-price>· {formatPrice(price * quantity)}</span> : null}
          </button>
        </div>
      ) : null}

      <Drawer open={guideOpen} onClose={() => setGuideOpen(false)} title="Guía de talles" widthClass="max-w-[520px]">
        <div className="px-5 py-6">{sizeGuide ? <Markdown source={sizeGuide} /> : null}</div>
      </Drawer>
    </div>
  );
}
