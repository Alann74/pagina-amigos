const priceFormatter = new Intl.NumberFormat("es-AR", {
  style: "decimal",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  useGrouping: true,
});

/** $45.000 — punto de miles, sin decimales */
export function formatPrice(value: number): string {
  return `$${priceFormatter.format(Math.round(value))}`;
}

/** Precio con descuento por efectivo/transferencia, redondeado al peso */
export function cashPrice(value: number, discountPercent: number): number {
  if (!discountPercent) return value;
  return Math.round((value * (100 - discountPercent)) / 100);
}

/** #INE-0001 */
export function formatOrderNumber(n: number): string {
  return `#INE-${String(n).padStart(4, "0")}`;
}

export function formatWithdrawalNumber(n: number): string {
  return `#ARR-${String(n).padStart(4, "0")}`;
}

/** "OFF WHITE" → "Off white" */
export function displayColor(name: string | null | undefined): string {
  if (!name) return "";
  const lower = name.toLocaleLowerCase("es-AR");
  return lower.charAt(0).toLocaleUpperCase("es-AR") + lower.slice(1);
}

export function displaySize(size: string): string {
  return size === "UNICO" ? "Único" : size;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SIZE_ORDER: Record<string, number> = { XXS: 5, XS: 10, S: 30, M: 40, L: 50, XL: 60, XXL: 70, XXXL: 80, UNICO: 100 };

export function sizeOrder(size: string): number {
  const key = size.trim().toUpperCase();
  if (key in SIZE_ORDER) return SIZE_ORDER[key];
  const n = Number(key);
  return Number.isFinite(n) ? 200 + n : 500;
}

export function formatDate(date: Date | string, withTime = false): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}
