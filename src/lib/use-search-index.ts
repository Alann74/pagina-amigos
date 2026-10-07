"use client";

import { useEffect, useState } from "react";
import type { SearchEntry } from "@/lib/search";

let cache: SearchEntry[] | null = null;
let inflight: Promise<SearchEntry[]> | null = null;

export function loadSearchIndex(): Promise<SearchEntry[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch("/api/search")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SearchEntry[]) => {
        cache = data;
        return data;
      })
      .catch(() => {
        inflight = null;
        return [];
      });
  }
  return inflight;
}

/** Índice liviano del catálogo (se baja una sola vez y queda en memoria). */
export function useSearchIndex(enabled = true): SearchEntry[] | null {
  const [data, setData] = useState<SearchEntry[] | null>(cache);
  useEffect(() => {
    if (!enabled || data) return;
    let alive = true;
    void loadSearchIndex().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [enabled, data]);
  return data;
}
