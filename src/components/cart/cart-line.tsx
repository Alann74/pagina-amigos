"use client";

import Image from "next/image";
import Link from "next/link";
import { MinusIcon, PlusIcon } from "@/components/icons";
import { displayColor, displaySize, formatPrice } from "@/lib/format";
import { MAX_QTY, useCart, type CartItem } from "@/stores/cart";

export function CartLine({ item, compact = false }: { item: CartItem; compact?: boolean }) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const changeVariant = useCart((s) => s.changeVariant);

  const sizes = [...new Set(item.options.map((o) => o.size))];
  const colorsForSize = item.options.filter((o) => o.size === item.size);
  const hasColors = item.options.some((o) => o.color);

  const pick = (size: string, color: string | null) => {
    const exact = item.options.find((o) => o.size === size && o.color === color && o.available);
    const fallback = item.options.find((o) => o.size === size && o.available);
    const next = exact ?? fallback;
    if (next) changeVariant(item.variantId, next);
  };

  return (
    <li className="flex gap-4 py-5" data-testid="cart-line">
      <Link href={`/producto/${item.slug}`} className="relative block aspect-[3/4] w-[84px] shrink-0 overflow-hidden bg-soft sm:w-24">
        {item.image ? <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" /> : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/producto/${item.slug}`} className="text-[13px] leading-snug">
            {item.name}
          </Link>
          <p className="shrink-0 text-[13px] tabular-nums">{formatPrice(item.price * item.quantity)}</p>
        </div>
        {item.articleCode ? <p className="mt-0.5 text-[11px] text-mute">Art. {item.articleCode}</p> : null}
        <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-2 ${compact ? "" : "sm:mt-3"}`}>
          {sizes.length > 1 ? (
            <label className="flex items-center gap-1.5 text-[12px]">
              <span className="text-mute">Talle</span>
              <select
                value={item.size}
                onChange={(e) => pick(e.target.value, item.color)}
                className="border-b border-line bg-transparent py-0.5 pr-1 text-[12px] focus:border-ink focus:outline-none"
                aria-label={`Talle de ${item.name}`}
              >
                {sizes.map((s) => (
                  <option key={s} value={s} disabled={!item.options.some((o) => o.size === s && o.available)}>
                    {displaySize(s)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-[12px]">
              <span className="text-mute">Talle</span> {displaySize(item.size)}
            </p>
          )}
          {hasColors ? (
            colorsForSize.length > 1 ? (
              <label className="flex items-center gap-1.5 text-[12px]">
                <span className="text-mute">Color</span>
                <select
                  value={item.color ?? ""}
                  onChange={(e) => pick(item.size, e.target.value || null)}
                  className="border-b border-line bg-transparent py-0.5 pr-1 text-[12px] focus:border-ink focus:outline-none"
                  aria-label={`Color de ${item.name}`}
                >
                  {colorsForSize.map((o) => (
                    <option key={o.variantId} value={o.color ?? ""} disabled={!o.available}>
                      {displayColor(o.color)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-[12px]">
                <span className="text-mute">Color</span> {displayColor(item.color)}
              </p>
            )
          ) : null}
        </div>
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex h-9 items-center border border-line" role="group" aria-label={`Cantidad de ${item.name}`}>
            <button
              type="button"
              className="flex h-full w-9 items-center justify-center disabled:text-faint"
              onClick={() => setQuantity(item.variantId, item.quantity - 1)}
              aria-label="Restar una"
            >
              <MinusIcon size={14} />
            </button>
            <span className="w-7 text-center text-[13px] tabular-nums" aria-live="polite" data-testid="cart-line-qty">
              {item.quantity}
            </span>
            <button
              type="button"
              className="flex h-full w-9 items-center justify-center disabled:text-faint"
              onClick={() => setQuantity(item.variantId, item.quantity + 1)}
              disabled={item.quantity >= MAX_QTY}
              aria-label="Sumar una"
            >
              <PlusIcon size={14} />
            </button>
          </div>
          <button type="button" onClick={() => remove(item.variantId)} className="label text-mute underline-offset-4 hover:text-ink hover:underline">
            Eliminar
          </button>
        </div>
      </div>
    </li>
  );
}
