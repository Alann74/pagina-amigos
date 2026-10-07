"use client";

// Las fotos se procesan una sola vez al importarlas (WebP en varios anchos) y se sirven
// directo desde Vercel Blob. Este loader elige el ancho pregenerado más cercano, así no
// gastamos el optimizador de imágenes de Vercel y la carga es instantánea.
//   productos:  .../p/<archivo>-w400.webp | -w800 | -w1200
//   campañas:   .../c/<archivo>-w800.webp | -w1600 | -w2400

const PRODUCT_WIDTHS = [400, 800, 1200];
const CAMPAIGN_WIDTHS = [800, 1600, 2400];
const PATTERN = /-w(\d+)\.webp$/;

export default function ineditaImageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  if (PATTERN.test(src)) {
    const widths = src.includes("/c/") ? CAMPAIGN_WIDTHS : PRODUCT_WIDTHS;
    const chosen = widths.find((w) => w >= width) ?? widths[widths.length - 1];
    return src.replace(PATTERN, `-w${chosen}.webp`);
  }
  // Imágenes sin procesar (placeholders, íconos): se sirven tal cual
  const sep = src.includes("?") ? "&" : "?";
  return `${src}${sep}w=${width}`;
}
