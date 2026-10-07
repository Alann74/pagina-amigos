"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CartOption = {
  variantId: number;
  size: string;
  color: string | null;
  price: number;
  available: boolean;
};

export type CartItem = {
  variantId: number;
  productId: number;
  slug: string;
  name: string;
  articleCode: string | null;
  size: string;
  color: string | null;
  price: number;
  image: string | null;
  quantity: number;
  options: CartOption[];
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  lastAddedAt: number;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  remove: (variantId: number) => void;
  setQuantity: (variantId: number, quantity: number) => void;
  changeVariant: (variantId: number, next: CartOption) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

export const MAX_QTY = 10;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      lastAddedAt: 0,
      add: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          const items = existing
            ? state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, ...item, quantity: Math.min(MAX_QTY, i.quantity + quantity) } : i,
              )
            : [...state.items, { ...item, quantity: Math.min(MAX_QTY, quantity) }];
          return { items, isOpen: true, lastAddedAt: Date.now() };
        }),
      remove: (variantId) => set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
      setQuantity: (variantId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.variantId !== variantId)
              : state.items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(MAX_QTY, quantity) } : i)),
        })),
      changeVariant: (variantId, next) =>
        set((state) => {
          const current = state.items.find((i) => i.variantId === variantId);
          if (!current || next.variantId === variantId) return state;
          const merged = state.items.find((i) => i.variantId === next.variantId);
          const rest = state.items.filter((i) => i.variantId !== variantId && i.variantId !== next.variantId);
          const updated: CartItem = {
            ...current,
            variantId: next.variantId,
            size: next.size,
            color: next.color,
            price: next.price,
            quantity: Math.min(MAX_QTY, current.quantity + (merged?.quantity ?? 0)),
          };
          const index = state.items.findIndex((i) => i.variantId === variantId);
          rest.splice(Math.min(index, rest.length), 0, updated);
          return { items: rest };
        }),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: "inedita-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      skipHydration: true,
    },
  ),
);

export function cartCount(items: CartItem[]): number {
  return items.reduce((acc, i) => acc + i.quantity, 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((acc, i) => acc + i.price * i.quantity, 0);
}
