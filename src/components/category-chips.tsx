"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CatalogCategory } from "@/lib/catalog";

/** Atajo a las categorías arriba de los listados (se desliza con el dedo en el celular). */
export function CategoryChips({ categories, active }: { categories: CatalogCategory[]; active: string | null }) {
  const listRef = useRef<HTMLUListElement>(null);
  // La categoría actual queda a la vista aunque esté al final de la fila
  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>("[aria-current=page]");
    if (list && current) list.scrollLeft = Math.max(0, current.offsetLeft - list.clientWidth / 2 + current.clientWidth / 2);
  }, [active]);
  const items = [{ slug: null as string | null, name: "Todo", href: "/productos" }, ...categories.filter((c) => c.productCount > 0).map((c) => ({ slug: c.slug, name: c.name, href: `/categoria/${c.slug}` }))];
  if (items.length < 3) return null;
  return (
    <nav aria-label="Categorías" className="-mt-2 mb-4 sm:-mt-4 sm:mb-6">
      <ul ref={listRef} className="scrollbar-none flex gap-2 overflow-x-auto px-4 sm:px-8">
        {items.map((c) => {
          const on = c.slug === active;
          return (
            <li key={c.href} className="shrink-0">
              <Link
                href={c.href}
                aria-current={on ? "page" : undefined}
                className={`label flex h-9 items-center border px-3.5 transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink"}`}
              >
                {c.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
