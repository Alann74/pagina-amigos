"use client";

import { useShopConfig } from "@/components/shop-config";
import { cashPrice, formatPrice } from "@/lib/format";

export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const { freeShippingThreshold } = useShopConfig();
  if (!freeShippingThreshold || freeShippingThreshold <= 0) return null;
  const missing = Math.max(0, freeShippingThreshold - subtotal);
  const progress = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
  return (
    <div className="px-5 pt-4" data-testid="free-shipping">
      <p className="text-[12px]">
        {missing > 0 ? (
          <>
            Te faltan <strong className="font-medium tabular-nums">{formatPrice(missing)}</strong> para el envío gratis
          </>
        ) : (
          <strong className="font-medium">¡Tenés envío gratis!</strong>
        )}
      </p>
      <div className="mt-2 h-[2px] w-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function CartTotals({ subtotal }: { subtotal: number }) {
  const { cashDiscountPercent, installments } = useShopConfig();
  const cash = cashPrice(subtotal, cashDiscountPercent);
  return (
    <dl className="space-y-1.5 text-[13px]">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="tabular-nums" data-testid="cart-subtotal">
          {formatPrice(subtotal)}
        </dd>
      </div>
      {cashDiscountPercent > 0 ? (
        <div className="flex justify-between font-medium">
          <dt>Con {cashDiscountPercent}% OFF efectivo / transferencia</dt>
          <dd className="tabular-nums" data-testid="cart-cash-total">
            {formatPrice(cash)}
          </dd>
        </div>
      ) : null}
      {installments > 1 ? (
        <div className="flex justify-between text-mute">
          <dt>o {installments} cuotas sin interés de</dt>
          <dd className="tabular-nums">{formatPrice(Math.ceil(subtotal / installments))}</dd>
        </div>
      ) : null}
    </dl>
  );
}
