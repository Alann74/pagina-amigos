"use client";

import Image from "next/image";
import { PriceText } from "@/components/wholesale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { searchEntries } from "@/lib/search";
import { useHydrated } from "@/lib/use-hydrated";
import { useSearchIndex } from "@/lib/use-search-index";
import { useUi } from "@/stores/ui";

const SUGGESTIONS = ["Vestidos", "Jeans", "Remeras", "Blazers", "Musculosas", "Carteras"];

export function SearchOverlay() {
  const open = useUi((s) => s.searchOpen);
  const setSearch = useUi((s) => s.setSearch);
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const index = useSearchIndex(open);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => (index && deferred.trim().length >= 2 ? searchEntries(index, deferred, 12) : []), [index, deferred]);
  // Sin búsqueda: lo último que entró, para inspirar
  const newest = useMemo(() => (index ? [...index].filter((e) => e.image && !e.soldOut).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 6) : []), [index]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSearch(false);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setSearch]);

  if (!hydrated || !open) return null;
  const close = () => setSearch(false);

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-paper animate-fade-in" role="dialog" aria-modal="true" aria-label="Buscar productos">
      <form
        role="search"
        className="mx-auto flex w-full max-w-[1600px] items-center gap-3 border-b border-line px-4 sm:px-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            close();
            router.push(`/buscar?q=${encodeURIComponent(query.trim())}`);
          }
        }}
      >
        <SearchIcon className="shrink-0" />
        <label htmlFor="search-input" className="sr-only">
          Buscar
        </label>
        <input
          id="search-input"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Buscá vestidos, jeans, art. 39603…"
          className="h-16 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
          data-testid="search-input"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="nav-link h-11 px-2 text-mute hover:text-ink"
          >
            Borrar
          </button>
        ) : null}
        <button type="button" onClick={close} className="-mr-2 flex h-11 w-11 items-center justify-center" aria-label="Cerrar búsqueda">
          <CloseIcon />
        </button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8">
          {deferred.trim().length < 2 ? (
            <div>
              <p className="label text-mute">Sugerencias</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => setQuery(s)} className="label border border-line px-3 py-2 hover:border-ink">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
              {newest.length ? (
                <>
                  <p className="label mt-10 text-mute">Nuevos ingresos</p>
                  <ul className="mt-4 grid grid-cols-3 gap-x-1 gap-y-5 sm:grid-cols-6">
                    {newest.map((r) => (
                      <li key={r.id}>
                        <Link href={`/producto/${r.slug}`} onClick={close} className="block">
                          <div className="relative aspect-[3/4] overflow-hidden bg-soft">
                            {r.image ? <Image src={r.image} alt={r.name} fill sizes="(min-width:640px) 16vw, 33vw" className="object-cover" /> : null}
                          </div>
                          <p className="mt-2 truncate text-[12px]">{r.name}</p>
                          <p className="text-[12px] tabular-nums text-mute"><PriceText productId={r.id} retail={r.price} /></p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : !index ? (
            <p className="label text-mute">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-mute">No encontramos resultados para “{deferred}”. Probá con otra palabra o consultanos por WhatsApp.</p>
          ) : (
            <>
              <p className="label text-mute" aria-live="polite">
                {results.length} {results.length === 1 ? "resultado" : "resultados"}
              </p>
              <ul className="mt-4 grid grid-cols-2 gap-x-1 gap-y-6 sm:grid-cols-4 lg:grid-cols-6" data-testid="search-results">
                {results.map((r) => (
                  <li key={r.id}>
                    <Link href={`/producto/${r.slug}`} onClick={close} className="group block">
                      <div className="relative aspect-[3/4] overflow-hidden bg-soft">
                        {r.image ? (
                          <Image src={r.image} alt={r.name} fill sizes="(min-width:1024px) 16vw, 50vw" className="object-cover" />
                        ) : null}
                      </div>
                      <p className="mt-2 text-[13px] leading-snug">{r.name}</p>
                      <p className="text-[13px] tabular-nums text-mute"><PriceText productId={r.id} retail={r.price} /></p>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`/buscar?q=${encodeURIComponent(deferred.trim())}`} onClick={close} className="btn btn-secondary mt-8 w-full sm:w-auto">
                Ver todos los resultados
              </Link>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
