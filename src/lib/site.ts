export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const BRAND = "INEDITA";
export const DEFAULT_DESCRIPTION =
  "INEDITA — tienda de ropa de mujer en Rosario. Nueva colección, envíos y retiro en Mitre 830. Pedí por WhatsApp.";
