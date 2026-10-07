"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BagIcon, HeartIcon, MenuIcon, SearchIcon } from "@/components/icons";
import { Logo } from "@/components/layout/logo";
import { cartCount, useCart } from "@/stores/cart";
import { useFavorites } from "@/stores/favorites";
import { useUi } from "@/stores/ui";
import { useHydrated } from "@/lib/use-hydrated";

export type HeaderLink = { href: string; label: string };

export function Header({ links = [] }: { links?: HeaderLink[] }) {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const openCart = useCart((s) => s.open);
  const favorites = useFavorites((s) => s.items.length);
  const setMenu = useUi((s) => s.setMenu);
  const setSearch = useUi((s) => s.setSearch);
  const [scrolled, setScrolled] = useState(false);
  const count = hydrated ? cartCount(items) : 0;
  // Cuando se agrega una prenda, el número de la bolsa da un saltito (no al cargar la bolsa guardada)
  const [bump, setBump] = useState(0);
  const prevCount = useRef(0);
  const ready = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => (ready.current = true), 1000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (ready.current && count > prevCount.current) setBump((b) => b + 1);
    prevCount.current = count;
  }, [count]);

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
      style={{ viewTransitionName: "site-header" }}
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
            <span className={`nav-link hidden ${links.length ? "2xl:inline" : "lg:inline"}`}>Menú</span>
          </button>
          <button
            type="button"
            onClick={() => setSearch(true)}
            className={`flex h-11 items-center gap-2 px-2.5 ${links.length ? "lg:hidden" : ""}`}
            aria-label="Buscar"
            aria-haspopup="dialog"
          >
            <SearchIcon />
            <span className="nav-link hidden lg:inline">Buscar</span>
          </button>
          {links.length ? (
            <nav aria-label="Principal" className="ml-3 hidden items-center gap-6 lg:flex xl:gap-7">
              {links.map((l, i) => (
                <Link key={l.href} href={l.href} className={`nav-link link-underline py-1 ${i >= 5 ? "hidden 2xl:inline" : i >= 3 ? "hidden xl:inline" : ""}`}>
                  {l.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
        <Logo />
        <div className="flex items-center justify-end">
          {links.length ? (
            <button type="button" onClick={() => setSearch(true)} className="hidden h-11 items-center gap-2 px-2.5 lg:flex" aria-label="Buscar" aria-haspopup="dialog">
              <SearchIcon />
              <span className="nav-link">Buscar</span>
            </button>
          ) : null}
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
                key={bump}
                className={`absolute right-0.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-medium leading-none text-paper lg:static lg:h-auto lg:min-w-0 lg:bg-transparent lg:p-0 lg:text-2xs lg:text-ink ${bump ? "animate-pop" : ""}`}
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
