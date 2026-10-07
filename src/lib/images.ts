import sharp from "sharp";
import { putFile } from "@/lib/storage";

export const PRODUCT_WIDTHS = [400, 800, 1200] as const;
export const CAMPAIGN_WIDTHS = [800, 1600, 2400] as const;

export type ProcessedImage = { url: string; width: number; height: number; urls: string[] };

/** Proporción alto/ancho de la foto original (después de aplicar la rotación EXIF). */
export async function imageRatio(input: Buffer): Promise<number | null> {
  const meta = await sharp(input, { failOn: "none" }).metadata();
  if (!meta.width || !meta.height) return null;
  const rotated = (meta.orientation ?? 1) >= 5;
  return rotated ? meta.width / meta.height : meta.height / meta.width;
}

/**
 * Producto: lienzo 3:4 (1200×1600 máx.), fondo blanco (las PNG recortadas quedan sobre blanco),
 * sin recortar la prenda. Se generan 3 anchos en WebP.
 */
export async function processProductImage(input: Buffer, basePath: string, opts: { fit?: "contain" | "cover" } = {}): Promise<ProcessedImage> {
  const fit = opts.fit ?? "contain";
  const position = fit === "cover" ? "top" : "centre";
  // La foto original (a veces PNG de muchos MB) se decodifica una sola vez: de esta base salen todos los tamaños
  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(1200, 1600, { fit, position, background: "#ffffff", withoutEnlargement: false })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const base = () => sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  const outputs = await Promise.all(
    PRODUCT_WIDTHS.map(async (width) => {
      const pipeline = width === 1200 ? base() : base().resize(width, Math.round((width * 4) / 3));
      const out = await pipeline.webp({ quality: width >= 1200 ? 80 : 78, effort: 4 }).toBuffer();
      return { path: `${basePath}-w${width}.webp`, out, type: "image/webp" };
    }),
  );
  // JPG para compartir (Open Graph / feed de Meta)
  const share = await base().resize(1200, 1500, { fit, position, background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  outputs.push({ path: `${basePath}-share.jpg`, out: share, type: "image/jpeg" });
  const urls = await Promise.all(outputs.map((o) => putFile(o.path, o.out, o.type)));
  return { url: urls[PRODUCT_WIDTHS.indexOf(1200)], width: 1200, height: 1600, urls };
}

/** Campaña / hero / look: se respeta la proporción original, lado mayor hasta 2400. */
export async function processCampaignImage(input: Buffer, basePath: string): Promise<ProcessedImage> {
  const meta = await sharp(input, { failOn: "none" }).rotate().metadata();
  const ratio = meta.width && meta.height ? meta.height / meta.width : 1.25;
  const urls: string[] = [];
  let mainUrl = "";
  for (const width of CAMPAIGN_WIDTHS) {
    const out = await sharp(input, { failOn: "none" })
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width, withoutEnlargement: false })
      .webp({ quality: 78, effort: 4 })
      .toBuffer();
    const url = await putFile(`${basePath}-w${width}.webp`, out, "image/webp");
    urls.push(url);
    if (width === 1600) mainUrl = url;
  }
  // JPG para compartir (Open Graph): mismo encuadre, 1200 de ancho
  const share = await sharp(input, { failOn: "none" }).rotate().flatten({ background: "#ffffff" }).resize({ width: 1200 }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  urls.push(await putFile(`${basePath}-share.jpg`, share, "image/jpeg"));
  return { url: mainUrl, width: 1600, height: Math.round(1600 * ratio), urls };
}

/** Versión JPG 1200×1500 para Open Graph / feed de Meta (no aceptan bien WebP en todos lados). */
export async function processShareImage(input: Buffer, basePath: string, fit: "contain" | "cover" = "contain"): Promise<string> {
  const out = await sharp(input, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(1200, 1500, { fit, position: fit === "cover" ? "top" : "centre", background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return putFile(`${basePath}-share.jpg`, out, "image/jpeg");
}
