"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/layout/drawer";
import { FilterIcon, GridOneIcon, GridTwoIcon } from "@/components/icons";
import { ProductCard } from "@/components/product/product-card";
import { displayColor, displaySize, formatPrice, sizeOrder, slugify } from "@/lib/format";
import type { SearchEntry } from "@/lib/search";
import { useHydrated } from "@/lib/use-hydrated";
import { useUi } from "@/stores/ui";

type Sort = "relevancia" | "nuevos" | "precio-asc" | "precio-desc";

const SORT_LABEL: Record<Sort, string> = {
  relevancia: "Destacados",
  nuevos: "Novedades",
  "precio-asc": "Menor precio",
  "precio-desc": "Mayor precio",
};

type PriceRange = { id: string; label: string; min: number; max: number | null };

const PRICE_RANGES: PriceRange[] = [
  { id: "0-40000", label: `Hasta ${formatPrice(40000)}`, min: 0, max: 40000 },
  { id: "40000-70000", label: `${formatPrice(40000)} – ${formatPrice(70000)}`, min: 40000, max: 70000 },
  { id: "70000-100000", label: `${formatPrice(70000)} – ${formatPrice(100000)}`, min: 70000, max: 100000 },
  { id: "100000-", label: `Más de ${formatPrice(100000)}`, min: 100000, max: null },
];

const PAGE = 24;

type Filters = { sizes: string[]; colors: string[]; price: string | null; sort: Sort };

function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  const sort = (p.get("orden") as Sort) || "relevancia";
  return {
    sizes: p.get("talle")?.split(",").filter(Boolean) ?? [],
    colors: p.get("color")?.split(",").filter(Boolean) ?? [],
    price: p.get("precio"),
    sort: sort in SORT_LABEL ? sort : "relevancia",
  };
}

function writeFilters(f: Filters) {
  const p = new URLSearchParams(window.location.search);
  const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
  set("talle", f.sizes.join(","));
  set("color", f.colors.join(","));
  set("precio", f.price);
  set("orden", f.sort === "relevancia" ? null : f.sort);
  const qs = p.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}

export function ProductListing({ products, emptyText = "No hay productos para mostrar." }: { products: SearchEntry[]; emptyText?: string }) {
  const hydrated = useHydrated();
  const mobileColumns = useUi((s) => s.mobileColumns);
  const setMobileColumns = useUi((s) => s.setMobileColumns);
  const [filters, setFilters] = useState<Filters>({ sizes: [], colors: [], price: null, sort: "relevancia" });
  const [visible, setVisible] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setFilters(readFilters());
  }, []);

  const update = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      writeFilters(next);
      return next;
    });
    setVisible(PAGE);
  }, []);

  const allSizes = useMemo(() => [...new Set(products.flatMap((p) => p.sizes))].sort((a, b) => sizeOrder(a) - sizeOrder(b)), [products]);
  const allColors = useMemo(
    () => [...new Set(products.flatMap((p) => p.colors))].sort((a, b) => a.localeCompare(b, "es")),
    [products],
  );

  const filtered = useMemo(() => {
    const range = PRICE_RANGES.find((r) => r.id === filters.price);
    const colorSet = new Set(filters.colors);
    let list = products.filter((p) => {
      if (filters.sizes.length && !filters.sizes.some((s) => p.sizes.includes(s))) return false;
      if (colorSet.size && !p.colors.some((c) => colorSet.has(slugify(c)))) return false;
      if (range && (p.price < range.min || (range.max !== null && p.price > range.max))) return false;
      return true;
    });
    if (filters.sort === "nuevos") list = [...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || Number(a.soldOut) - Number(b.soldOut));
    if (filters.sort === "precio-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (filters.sort === "precio-desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, filters]);

  const activeCount = filters.sizes.length + filters.colors.length + (filters.price ? 1 : 0);
  const cols = hydrated ? mobileColumns : 2;
  const shown = filtered.slice(0, visible);

  return (
    <div>
      <div className="sticky top-13 z-20 -mx-0 flex h-12 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur-sm sm:top-16 sm:px-8">
        <button type="button" onClick={() => setFiltersOpen(true)} className="nav-link flex h-11 items-center gap-2" data-testid="open-filters">
          <FilterIcon size={18} /> Filtrar{activeCount ? ` (${activeCount})` : ""}
        </button>
        <p className="label hidden text-mute sm:block" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
        </p>
        <div className="flex items-center gap-1">
          <label className="sr-only" htmlFor="sort-select">
            Ordenar
          </label>
          <select
            id="sort-select"
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as Sort })}
            className="nav-link h-11 cursor-pointer bg-transparent pr-1 text-right focus:outline-none"
            data-testid="sort-select"
          >
            {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
          <div className="ml-1 flex items-center lg:hidden" role="group" aria-label="Cantidad de columnas">
            <button
              type="button"
              onClick={() => setMobileColumns(1)}
              aria-pressed={cols === 1}
              aria-label="Ver de a una"
              className={`flex h-11 w-9 items-center justify-center ${cols === 1 ? "text-ink" : "text-faint"}`}
            >
              <GridOneIcon size={18} />
            </button>
            <button
              type="button"
              onClick={() => setMobileColumns(2)}
              aria-pressed={cols === 2}
              aria-label="Ver de a dos"
              className={`flex h-11 w-9 items-center justify-center ${cols === 2 ? "text-ink" : "text-faint"}`}
            >
              <GridTwoIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-5 py-20 text-center">
          <p className="text-sm text-mute">{activeCount ? "No hay productos con esos filtros." : emptyText}</p>
          {activeCount ? (
            <button type="button" className="btn btn-secondary mt-6" onClick={() => update({ sizes: [], colors: [], price: null })}>
              Limpiar filtros
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <ul
            className={`grid gap-x-1 gap-y-8 px-1 pt-1 sm:gap-x-2 sm:px-2 lg:grid-cols-4 lg:gap-x-3 lg:gap-y-12 lg:px-3 ${cols === 1 ? "grid-cols-1" : "grid-cols-2"}`}
            data-testid="product-grid"
          >
            {shown.map((p, i) => (
              <li key={p.id} className="animate-fade-in">
                <ProductCard product={p} priority={i < 4} sizes={cols === 1 ? "(min-width: 1024px) 25vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"} />
              </li>
            ))}
          </ul>
          {visible < filtered.length ? (
            <div className="mt-12 flex flex-col items-center gap-3">
              <p className="label text-mute">
                {shown.length} de {filtered.length}
              </p>
              <button type="button" className="btn btn-secondary min-w-56" onClick={() => setVisible((v) => v + PAGE)}>
                Ver más
              </button>
            </div>
          ) : null}
        </>
      )}

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtrar"
        side="left"
        footer={
          <div className="grid grid-cols-2 gap-3 p-5">
            <button type="button" className="btn btn-secondary" onClick={() => update({ sizes: [], colors: [], price: null })}>
              Limpiar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setFiltersOpen(false)} data-testid="apply-filters">
              Ver {filtered.length}
            </button>
          </div>
        }
      >
        <div className="space-y-10 px-5 py-6">
          {allSizes.length > 0 ? (
            <fieldset>
              <legend className="label font-medium">Talle</legend>
              <div className="mt-4 flex flex-wrap gap-2">
                {allSizes.map((s) => {
                  const on = filters.sizes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => update({ sizes: on ? filters.sizes.filter((x) => x !== s) : [...filters.sizes, s] })}
                      className={`h-10 min-w-12 border px-3 text-[13px] transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}
                    >
                      {displaySize(s)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          {allColors.length > 0 ? (
            <fieldset>
              <legend className="label font-medium">Color</legend>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
                {allColors.map((c) => {
                  const slug = slugify(c);
                  const on = filters.colors.includes(slug);
                  return (
                    <label key={c} className="flex cursor-pointer items-center gap-3 py-1.5 text-[13px]">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => update({ colors: on ? filters.colors.filter((x) => x !== slug) : [...filters.colors, slug] })}
                        className="h-4 w-4 appearance-none border border-ink checked:bg-ink"
                      />
                      {displayColor(c)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <fieldset>
            <legend className="label font-medium">Precio</legend>
            <div className="mt-4 space-y-1">
              {PRICE_RANGES.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-3 py-1.5 text-[13px] tabular-nums">
                  <input
                    type="radio"
                    name="precio"
                    checked={filters.price === r.id}
                    onChange={() => update({ price: r.id })}
                    onClick={() => filters.price === r.id && update({ price: null })}
                    className="h-4 w-4 appearance-none rounded-full border border-ink checked:bg-ink"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Drawer>
    </div>
  );
}
