"use client";

import { useShopConfig } from "@/components/shop-config";
import { useWholesale } from "@/components/wholesale";
import { cashPrice, formatPrice } from "@/lib/format";

export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const { freeShippingThreshold } = useShopConfig();
  const { active } = useWholesale();
  if (active || !freeShippingThreshold || freeShippingThreshold <= 0) return null;
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

/**
 * Totales de la bolsa. `welcomePercent`: descuento de bienvenida del pop-up (reemplaza al de efectivo si es mayor).
 * En modo mayorista: sin cuotas, con el descuento propio de mayoristas y el aviso de compra mínima.
 */
export function CartTotals({ subtotal, units = 0, welcomePercent = 0 }: { subtotal: number; units?: number; welcomePercent?: number }) {
  const { cashDiscountPercent, installments } = useShopConfig();
  const { active, session } = useWholesale();
  const welcome = !active && welcomePercent > cashDiscountPercent;
  const percent = active ? (session?.cashDiscountPercent ?? 0) : Math.max(cashDiscountPercent, welcomePercent);
  const cash = cashPrice(subtotal, percent);
  const minAmount = active ? (session?.minAmount ?? 0) : 0;
  const minUnits = active ? (session?.minUnits ?? 0) : 0;
  return (
    <dl className="space-y-1.5 text-[13px]">
      <div className="flex justify-between">
        <dt>{active ? "Subtotal mayorista" : "Subtotal"}</dt>
        <dd className="tabular-nums" data-testid="cart-subtotal" data-price>
          {formatPrice(subtotal)}
        </dd>
      </div>
      {percent > 0 ? (
        <div className="flex justify-between gap-3 font-medium">
          <dt>{welcome ? `Con tu ${percent}% OFF de bienvenida (efectivo / transferencia)` : `Con ${percent}% OFF efectivo / transferencia`}</dt>
          <dd className="tabular-nums" data-testid="cart-cash-total" data-price>
            {formatPrice(cash)}
          </dd>
        </div>
      ) : null}
      {!active && installments > 1 ? (
        <div className="flex justify-between text-mute">
          <dt>o {installments} cuotas sin interés de</dt>
          <dd className="tabular-nums" data-price>
            {formatPrice(Math.ceil(subtotal / installments))}
          </dd>
        </div>
      ) : null}
      {minAmount > 0 && subtotal < minAmount ? (
        <p className="pt-1 text-[12px]" data-testid="wholesale-min">
          Compra mínima mayorista: {formatPrice(minAmount)} (te faltan {formatPrice(minAmount - subtotal)})
        </p>
      ) : null}
      {minUnits > 0 && units < minUnits ? (
        <p className="pt-1 text-[12px]">
          Mínimo {minUnits} prendas por pedido (llevás {units})
        </p>
      ) : null}
    </dl>
  );
}
