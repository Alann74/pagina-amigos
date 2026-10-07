"use client";

import { createContext, useContext } from "react";

export type ShopConfig = {
  whatsappNumber: string;
  cashDiscountPercent: number;
  installments: number;
  freeShippingThreshold: number | null;
  storeAddressShort: string;
  siteUrl: string;
  welcome: { enabled: boolean; percent: number; title: string; text: string; delaySeconds: number };
};

const Ctx = createContext<ShopConfig | null>(null);

export function ShopConfigProvider({ value, children }: { value: ShopConfig; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShopConfig(): ShopConfig {
  const value = useContext(Ctx);
  if (!value) throw new Error("useShopConfig debe usarse dentro de ShopConfigProvider");
  return value;
}
