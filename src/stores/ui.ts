"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type UiState = {
  menuOpen: boolean;
  searchOpen: boolean;
  mobileColumns: 1 | 2;
  setMenu: (open: boolean) => void;
  setSearch: (open: boolean) => void;
  setMobileColumns: (n: 1 | 2) => void;
};

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      menuOpen: false,
      searchOpen: false,
      mobileColumns: 2,
      setMenu: (menuOpen) => set({ menuOpen, searchOpen: false }),
      setSearch: (searchOpen) => set({ searchOpen, menuOpen: false }),
      setMobileColumns: (mobileColumns) => set({ mobileColumns }),
    }),
    {
      name: "inedita-ui",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ mobileColumns: s.mobileColumns }),
      skipHydration: true,
    },
  ),
);
