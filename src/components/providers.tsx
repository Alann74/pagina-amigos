"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/stores/cart";
import { useFavorites } from "@/stores/favorites";
import { useRecent } from "@/stores/recent";
import { useUi } from "@/stores/ui";
import { captureAttribution } from "@/lib/attribution";
import { useHydrated } from "@/lib/use-hydrated";

export function ShopProviders() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    // Los stores persistidos se rehidratan recién en el cliente para no romper el SSR
    void useCart.persist.rehydrate();
    void useFavorites.persist.rehydrate();
    void useRecent.persist.rehydrate();
    void useUi.persist.rehydrate();
    captureAttribution();
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Navegación del lado del cliente: el Pixel no la detecta solo
    window.fbq?.("track", "PageView");
    useUi.getState().setMenu(false);
    useUi.getState().setSearch(false);
    useCart.getState().close();
  }, [pathname]);

  return null;
}

export function useStoreHydrated() {
  return useHydrated();
}
