// En Vercel, si no se define NEXT_PUBLIC_SITE_URL se usa la URL de producción del proyecto (*.vercel.app o el dominio).
const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000")).replace(/\/$/, "");

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const BRAND = "INEDITA";
export const DEFAULT_DESCRIPTION =
  "INEDITA — tienda de ropa de mujer en Rosario. Nueva colección, envíos y retiro en Mitre 830. Pedí por WhatsApp.";
