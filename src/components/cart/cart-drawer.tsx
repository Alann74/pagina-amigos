"use client";

import Link from "next/link";
import { Drawer } from "@/components/layout/drawer";
import { CartLine } from "@/components/cart/cart-line";
import { CartTotals, FreeShippingBar } from "@/components/cart/cart-totals";
import { CompleteLook } from "@/components/cart/complete-look";
import { cartCount, cartSubtotal, useCart } from "@/stores/cart";

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const count = cartCount(items);
  const subtotal = cartSubtotal(items);

  return (
    <Drawer
      open={isOpen}
      onClose={close}
      title={count ? `Tu bolsa (${count})` : "Tu bolsa"}
      testId="cart-drawer"
      footer={
        items.length > 0 ? (
          <div className="space-y-4 px-5 py-5">
            <CartTotals subtotal={subtotal} />
            <Link href="/carrito" onClick={close} className="btn btn-primary w-full" data-testid="checkout-link">
              Finalizar pedido
            </Link>
            <p className="text-center text-[11px] text-mute">Enviás el pedido por WhatsApp y coordinamos el pago y la entrega.</p>
          </div>
        ) : null
      }
    >
      {items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-6 px-8 py-16 text-center">
          <p className="text-sm text-mute">Tu bolsa está vacía.</p>
          <Link href="/productos" onClick={close} className="btn btn-primary">
            Ver colección
          </Link>
        </div>
      ) : (
        <>
          <FreeShippingBar subtotal={subtotal} />
          <ul className="divide-y divide-line px-5">
            {items.map((item) => (
              <CartLine key={item.variantId} item={item} compact />
            ))}
          </ul>
          <CompleteLook items={items} onNavigate={close} />
        </>
      )}
    </Drawer>
  );
}
