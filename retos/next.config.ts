import path from "node:path";
import type { NextConfig } from "next";

// Esta app vive en una subcarpeta del repo de la tienda: la raíz debe ser esta carpeta.
const root = path.resolve(__dirname);
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root },
  outputFileTracingRoot: root,
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
    ] }];
  },
};
export default nextConfig;
