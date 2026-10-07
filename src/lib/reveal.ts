import type { CSSProperties } from "react";

/** Retraso escalonado para la aparición al bajar (components/reveal.tsx): las tarjetas de una fila entran una detrás de otra. */
export function revealDelay(index: number, columns = 4): CSSProperties {
  return { ["--reveal-delay" as string]: `${(index % columns) * 80}ms` };
}
