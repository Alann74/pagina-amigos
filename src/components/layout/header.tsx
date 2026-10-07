"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BagIcon, HeartIcon, MenuIcon, SearchIcon } from "@/components/icons";
import { Logo } from "@/components/layout/logo";
import { cartCount, useCart } from "@/stores/cart";
import { useFavorites } from "@/stores/favorites";
import { useUi } from "@/stores/ui";
import { useHydrated } from "@/lib/use-hydrated";

export function Header() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const openCart = useCart((s) => s.open);
  const favorites = useFavorites((s) => s.items.length);
  const setMenu = useUi((s) => s.setMenu);
  const setSearch = useUi((s) => s.setSearch);
  const [scrolled, setScrolled] = useState(false);
  const count = hydrated ? cartCount(items) : 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 bg-paper/95 backdrop-blur-sm transition-[border-color] duration-200 supports-[backdrop-filter]:bg-paper/85 ${
        scrolled ? "border-b border-line" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto grid h-13 max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center px-2 sm:h-16 sm:px-6">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setMenu(true)}
            className="flex h-11 items-center gap-2 px-2.5"
            aria-label="Abrir menú"
            aria-haspopup="dialog"
          >
            <MenuIcon />
            <span className="nav-link hidden lg:inline">Menú</span>
          </button>
          <button
            type="button"
            onClick={() => setSearch(true)}
            className="flex h-11 items-center gap-2 px-2.5"
            aria-label="Buscar"
            aria-haspopup="dialog"
          >
            <SearchIcon />
            <span className="nav-link hidden lg:inline">Buscar</span>
          </button>
        </div>
        <Logo />
        <div className="flex items-center justify-end">
          <Link href="/favoritos" className="relative flex h-11 items-center gap-2 px-2.5" aria-label={`Favoritos${hydrated && favorites ? ` (${favorites})` : ""}`}>
            <HeartIcon filled={hydrated && favorites > 0} />
            <span className="nav-link hidden lg:inline">Favoritos</span>
          </Link>
          <button
            type="button"
            onClick={openCart}
            className="relative flex h-11 items-center gap-2 px-2.5"
            aria-label={`Carrito${count ? `, ${count} ${count === 1 ? "prenda" : "prendas"}` : ", vacío"}`}
            aria-haspopup="dialog"
            data-testid="cart-button"
          >
            <BagIcon />
            <span className="nav-link hidden lg:inline">Bolsa</span>
            {count > 0 ? (
              <span
                className="absolute right-0.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-medium leading-none text-paper lg:static lg:h-auto lg:min-w-0 lg:bg-transparent lg:p-0 lg:text-2xs lg:text-ink"
                data-testid="cart-count"
              >
                <span className="lg:hidden">{count}</span>
                <span className="hidden lg:inline">({count})</span>
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
}
