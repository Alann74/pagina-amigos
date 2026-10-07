"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type FavoriteItem = { productId: number; slug: string; name: string; price: number; image: string | null };

type FavoritesState = {
  items: FavoriteItem[];
  toggle: (item: FavoriteItem) => void;
  has: (productId: number) => boolean;
  remove: (productId: number) => void;
};

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (item) =>
        set((state) =>
          state.items.some((i) => i.productId === item.productId)
            ? { items: state.items.filter((i) => i.productId !== item.productId) }
            : { items: [item, ...state.items] },
        ),
      has: (productId) => get().items.some((i) => i.productId === productId),
      remove: (productId) => set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
    }),
    { name: "inedita-favorites", version: 1, storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
