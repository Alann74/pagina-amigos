export type Rounding = "ninguno" | "100" | "1000";

export const ROUNDING_LABEL: Record<Rounding, string> = {
  ninguno: "Sin redondeo",
  "100": "A la centena ($45.100)",
  "1000": "Al mil ($46.000)",
};

/** Redondea hacia arriba a la centena o al mil (un aumento nunca queda por debajo del cálculo). */
export function roundPrice(value: number, rounding: Rounding): number {
  const step = rounding === "1000" ? 1000 : rounding === "100" ? 100 : 1;
  return Math.max(step, Math.ceil(Math.round(value) / step) * step);
}

export function applyPercent(price: number, percent: number, rounding: Rounding): number {
  return roundPrice(price * (1 + percent / 100), rounding);
}
