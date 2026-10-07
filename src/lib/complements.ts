// Qué categorías combinan con cuáles, para "Completá tu look" y productos relacionados.
const TOPS = ["remeras", "musculosas", "blusas", "tops", "bodies", "camisas", "sweaters", "buzos"];
const BOTTOMS = ["jeans", "pantalones", "shorts", "polleras", "bermudas"];
const LAYERS = ["blazers", "camperas", "chalecos", "pilotos"];
const EXTRAS = ["carteras", "accesorios"];
const ONE_PIECE = ["vestidos", "monos"];

export function complementCategories(categorySlug: string | null): string[] {
  if (!categorySlug) return [...TOPS, ...BOTTOMS];
  if (TOPS.includes(categorySlug)) return [...BOTTOMS, ...LAYERS, ...EXTRAS];
  if (BOTTOMS.includes(categorySlug)) return [...TOPS, ...LAYERS, ...EXTRAS];
  if (LAYERS.includes(categorySlug)) return [...TOPS, ...BOTTOMS, ...ONE_PIECE];
  if (ONE_PIECE.includes(categorySlug)) return [...LAYERS, ...EXTRAS];
  if (EXTRAS.includes(categorySlug)) return [...ONE_PIECE, ...TOPS, ...BOTTOMS];
  return [...TOPS, ...BOTTOMS];
}

/** Elige productos de forma estable (sin Math.random) para que el resultado no salte entre renders. */
export function stablePick<T extends { id: number }>(list: T[], seed: number, count: number): T[] {
  return [...list]
    .sort((a, b) => ((a.id * 2654435761 + seed) % 997) - ((b.id * 2654435761 + seed) % 997))
    .slice(0, count);
}
