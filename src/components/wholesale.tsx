"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import { WHOLESALE_FLAG, type WholesaleSession } from "@/lib/wholesale-config";
import type { CartItem } from "@/stores/cart";

// Modo mayorista del lado del navegador. Las páginas se arman (y se guardan en caché) con los precios
// de la tienda; si la persona entró con el código, acá se piden los precios por mayor y se reemplazan.
// Mientras cargan, los precios quedan ocultos (clase "mayorista" que pone el script del <head>).

type Wholesale = {
  active: boolean;
  session: WholesaleSession | null;
  /** Precio a mostrar/cobrar para un producto (el mayorista si existe; si no, el de la tienda). */
  priceFor: (productId: number, retail: number) => number;
  hasWholesalePrice: (productId: number) => boolean;
  exit: () => Promise<void>;
};

const OFF: Wholesale = {
  active: false,
  session: null,
  priceFor: (_id, retail) => retail,
  hasWholesalePrice: () => false,
  exit: async () => {},
};

const Ctx = createContext<Wholesale>(OFF);

export function hasWholesaleFlag(): boolean {
  return typeof document !== "undefined" && document.cookie.split(/;\s*/).includes(`${WHOLESALE_FLAG}=1`);
}

function setHtmlMode(on: boolean) {
  const html = document.documentElement;
  html.classList.toggle("mayorista", on);
  html.classList.toggle("mayorista-listo", on);
}

async function exitWholesale() {
  await fetch("/api/mayoristas", { method: "DELETE" }).catch(() => null);
  setHtmlMode(false);
  window.location.href = new URL("/", window.location.origin).href;
}

export function WholesaleProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<WholesaleSession | null>(null);

  useEffect(() => {
    if (!hasWholesaleFlag()) return;
    let cancelled = false;
    fetch("/api/mayoristas", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<WholesaleSession>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (cancelled) return;
        setSession(data);
        setHtmlMode(true);
      })
      .catch(() => {
        if (!cancelled) setHtmlMode(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value: Wholesale = session
    ? {
        active: true,
        session,
        priceFor: (id, retail) => session.prices[id] ?? retail,
        hasWholesalePrice: (id) => id in session.prices,
        exit: exitWholesale,
      }
    : OFF;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWholesale(): Wholesale {
  return useContext(Ctx);
}

/** Precio unitario efectivo de un ítem de la bolsa. */
export function useCartPricing() {
  const { priceFor } = useWholesale();
  const unitPrice = (item: Pick<CartItem, "productId" | "price">) => priceFor(item.productId, item.price);
  const subtotal = (items: CartItem[]) => items.reduce((acc, i) => acc + unitPrice(i) * i.quantity, 0);
  return { unitPrice, subtotal };
}

/** Barra fija arriba de todo mientras se navega como mayorista. */
export function WholesaleBar() {
  const { active, exit } = useWholesale();
  if (!active) return null;
  return (
    <div className="bg-ink text-paper">
      <div className="mx-auto flex h-9 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-8">
        <p className="label truncate text-[10.5px]">Modo mayorista · precios por mayor</p>
        <button type="button" onClick={() => void exit()} className="label shrink-0 text-[10.5px] underline underline-offset-4">
          Salir
        </button>
      </div>
    </div>
  );
}

/** Precio de un producto: el de la tienda o, en modo mayorista, el precio por mayor. */
export function PriceText({ productId, retail, className }: { productId: number; retail: number; className?: string }) {
  const { priceFor } = useWholesale();
  return (
    <span className={className} data-price>
      {formatPrice(priceFor(productId, retail))}
    </span>
  );
}
