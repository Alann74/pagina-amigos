"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true solo en el cliente, después de hidratar. Evita desajustes con datos de localStorage. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
