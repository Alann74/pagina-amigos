import sharp from "sharp";
import { MEDIA_PREFIX, saveMedia, blobStorageSelected } from "@/lib/media";
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
 * Recorte a 3:4 de una foto con modelo: lo que sobra de alto se saca un tercio de arriba y dos tercios
 * de abajo (no se corta la cabeza y casi nunca la prenda); lo que sobra de ancho, parejo de los dos lados.
 */
export function coverBox(width: number, height: number): { left: number; top: number; width: number; height: number } {
  const target = 4 / 3;
  if (height / width > target) {
    const h = Math.round(width * target);
    return { left: 0, top: Math.round((height - h) * 0.35), width, height: h };
  }
  const w = Math.round(height / target);
  return { left: Math.round((width - w) / 2), top: 0, width: w, height };
}

/**
 * Producto: lienzo 3:4 (1200×1600 máx.). "contain": entera sobre blanco (las PNG recortadas de la prenda
 * sola); "cover": llena el lienzo (fotos con modelo, ver coverBox). Se generan 3 anchos en WebP.
 */
export async function processProductImage(input: Buffer, basePath: string, opts: { fit?: "contain" | "cover" } = {}): Promise<ProcessedImage> {
  const fit = opts.fit ?? "contain";
  // La foto original (a veces PNG de muchos MB) se decodifica una sola vez: de esta base salen todos los tamaños
  let source = sharp(input, { failOn: "none" }).rotate().flatten({ background: "#ffffff" });
  if (fit === "cover") {
    const { data: full, info: fi } = await source.raw().toBuffer({ resolveWithObject: true });
    source = sharp(full, { raw: { width: fi.width, height: fi.height, channels: fi.channels } }).extract(coverBox(fi.width, fi.height));
  }
  const { data, info } = await source
    .resize(1200, 1600, { fit: fit === "cover" ? "fill" : "contain", background: "#ffffff", withoutEnlargement: false })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const base = () => sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  if (!blobStorageSelected()) {
    // En la base se guarda solo la versión de 1200 (los demás tamaños se generan al pedirlos)
    const master = await base().webp({ quality: 82, effort: 4 }).toBuffer();
    await saveMedia(basePath, master, "image/webp", info.width, info.height);
    const url = `${MEDIA_PREFIX}${basePath}-w1200.webp`;
    return { url, width: info.width, height: info.height, urls: [url] };
  }
  const outputs = await Promise.all(
    PRODUCT_WIDTHS.map(async (width) => {
      const pipeline = width === 1200 ? base() : base().resize(width, Math.round((width * 4) / 3));
      const out = await pipeline.webp({ quality: width >= 1200 ? 80 : 78, effort: 4 }).toBuffer();
      return { path: `${basePath}-w${width}.webp`, out, type: "image/webp" };
    }),
  );
  // JPG para compartir (Open Graph / feed de Meta)
  const share = await base().resize(1200, 1500, { fit: "cover", position: "top", background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  outputs.push({ path: `${basePath}-share.jpg`, out: share, type: "image/jpeg" });
  const urls = await Promise.all(outputs.map((o) => putFile(o.path, o.out, o.type)));
  return { url: urls[PRODUCT_WIDTHS.indexOf(1200)], width: 1200, height: 1600, urls };
}

/** Campaña / hero / look: se respeta la proporción original, lado mayor hasta 2400. */
export async function processCampaignImage(input: Buffer, basePath: string): Promise<ProcessedImage> {
  const meta = await sharp(input, { failOn: "none" }).rotate().metadata();
  const ratio = meta.width && meta.height ? meta.height / meta.width : 1.25;
  if (!blobStorageSelected()) {
    const { data, info } = await sharp(input, { failOn: "none" })
      .rotate()
      .flatten({ background: "#ffffff" })
      .resize({ width: 2400, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    await saveMedia(basePath, data, "image/webp", info.width, info.height);
    const url = `${MEDIA_PREFIX}${basePath}-w1600.webp`;
    return { url, width: 1600, height: Math.round(1600 * ratio), urls: [url] };
  }
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
  // Con las fotos en la base, el JPG para compartir se genera al pedirlo (/m/<clave>-share.jpg)
  if (!blobStorageSelected()) return `${MEDIA_PREFIX}${basePath}-share.jpg`;
  const out = await sharp(input, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(1200, 1500, { fit, position: fit === "cover" ? "top" : "centre", background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return putFile(`${basePath}-share.jpg`, out, "image/jpeg");
}
