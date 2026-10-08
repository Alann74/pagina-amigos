import type { NextConfig } from "next";
import tiendanube from "./data/redirecciones-tiendanube.json";

// Dominio propio (sin "www"): se usa como dirección del sitio (links compartidos, sitemap, feed) recién cuando ya apunta
// a esta tienda. Mientras siga en Tienda Nube, se usa la dirección de Vercel. Se revisa en cada deploy.
const DOMAIN = "inedita-rosario.com";
const VERCEL_URL = "https://inedita-tienda.vercel.app";

async function siteUrl(): Promise<string | undefined> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (!process.env.VERCEL) return undefined;
  try {
    const res = await fetch(`https://${DOMAIN}/`, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(6000) });
    if (res.headers.get("server")?.toLowerCase() === "vercel" || res.headers.has("x-vercel-id")) return `https://${DOMAIN}`;
  } catch {}
  return VERCEL_URL;
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    qualities: [75],
  },
  serverExternalPackages: ["sharp"],
  // Archivos que lee el botón "Preparar base de datos" de /admin/instalacion
  outputFileTracingIncludes: {
    "/api/admin/setup": ["./drizzle/**/*", "./data/pos-productos.csv"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Links de la tienda anterior (Tienda Nube): cada producto y categoría lleva a su página nueva
  async redirects() {
    return [
      // El dominio va sin "www": www.inedita-rosario.com lleva a inedita-rosario.com (misma página)
      { source: "/:path*", has: [{ type: "host" as const, value: `www.${DOMAIN}` }], destination: `https://${DOMAIN}/:path*`, permanent: true },
      ...tiendanube.redirecciones.map((r) => ({ ...r, permanent: true })),
      { source: "/search", destination: "/buscar", permanent: true },
      { source: "/comprar", destination: "/carrito", permanent: false },
      { source: "/account/:path*", destination: "/", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default async function config(): Promise<NextConfig> {
  const url = await siteUrl();
  return url ? { ...nextConfig, env: { ...nextConfig.env, NEXT_PUBLIC_SITE_URL: url } } : nextConfig;
}
