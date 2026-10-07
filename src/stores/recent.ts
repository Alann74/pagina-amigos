"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type RecentState = {
  slugs: string[];
  push: (slug: string) => void;
};

export const useRecent = create<RecentState>()(
  persist(
    (set) => ({
      slugs: [],
      push: (slug) => set((state) => ({ slugs: [slug, ...state.slugs.filter((s) => s !== slug)].slice(0, 12) })),
    }),
    { name: "inedita-recent", version: 1, storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
