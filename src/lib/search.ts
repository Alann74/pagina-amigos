export type SearchEntry = {
  id: number;
  slug: string;
  name: string;
  articleCode: string | null;
  category: string | null;
  categorySlug: string | null;
  colors: string[];
  price: number;
  image: string | null;
  /** Fotos para deslizar en la tarjeta del listado (la primera es `image`) */
  images: string[];
  soldOut: boolean;
  badge: string | null;
  sizes: string[];
  publishedAt: string;
};

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function searchEntries(entries: SearchEntry[], query: string, limit = 24): SearchEntry[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    const name = normalize(entry.name);
    const haystack = `${name} ${normalize(entry.category ?? "")} ${entry.articleCode ?? ""} ${normalize(entry.colors.join(" "))}`;
    if (!terms.every((t) => haystack.includes(t))) continue;
    let score = 0;
    for (const t of terms) {
      if (name.startsWith(t)) score += 3;
      else if (name.includes(` ${t}`)) score += 2;
      else if (name.includes(t)) score += 1;
      if (entry.articleCode === t) score += 5;
    }
    if (entry.soldOut) score -= 2;
    scored.push({ entry, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.entry);
}
