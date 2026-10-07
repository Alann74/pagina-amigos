import { sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { media, productImages, settings } from "@/db/schema";
import { classifyPhoto } from "@/lib/photo-classify";

// Control del clasificador sin mirar las fotos: % de píxeles con tono de piel y % de borde blanco.
// Una foto con modelo tiene piel visible; la prenda sola, casi nada y el borde blanco.

async function features(data: Buffer) {
  const { data: px, info } = await sharp(data, { failOn: "none" }).flatten({ background: "#ffffff" }).resize(96, 128, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let skin = 0;
  let white = 0;
  let border = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const k = (y * info.width + x) * 3;
      const [r, g, b] = [px[k], px[k + 1], px[k + 2]];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (r > 95 && g > 40 && b > 20 && max - min > 15 && Math.abs(r - g) > 15 && r > g && r > b && !(r > 235 && g > 225)) skin++;
      if (x < 6 || x >= info.width - 6 || y < 6 || y >= info.height - 6) {
        border++;
        if (r > 240 && g > 240 && b > 240) white++;
      }
    }
  return { skin: Math.round((skin / (info.width * info.height)) * 1000) / 10, borde: Math.round((white / border) * 100) };
}

const pct = (list: number[], p: number) => (list.length ? list.slice().sort((a, b) => a - b)[Math.floor((list.length - 1) * p)] : 0);

export async function classificationReport() {
  const rows = await db
    .select({ title: productImages.sourceName, key: media.key, data: media.data })
    .from(productImages)
    .innerJoin(media, sql`${media.key} = ${productImages.blobPath}`);
  const byKind = new Map<string, { title: string; skin: number; borde: number }[]>();
  for (const r of rows) {
    const c = r.title ? classifyPhoto(r.title) : null;
    const kind = c ? `${c.kind}${r.title && /\.png$/i.test(r.title) ? "-png" : "-jpg"}` : "sin-nombre";
    const f = await features(r.data).catch(() => null);
    if (!f) continue;
    byKind.set(kind, [...(byKind.get(kind) ?? []), { title: r.title ?? "", ...f }]);
  }
  const resumen = Object.fromEntries(
    [...byKind.entries()].map(([k, l]) => [
      k,
      {
        fotos: l.length,
        pielP25: pct(l.map((x) => x.skin), 0.25),
        pielMediana: pct(l.map((x) => x.skin), 0.5),
        pielP75: pct(l.map((x) => x.skin), 0.75),
        bordeBlancoMediana: pct(l.map((x) => x.borde), 0.5),
        // las que menos piel tienen (posible prenda sola) y las que más (posible modelo)
        menosPiel: l.sort((a, b) => a.skin - b.skin).slice(0, 8).map((x) => `${x.title} ${x.skin}% b${x.borde}`),
        masPiel: l.slice(-5).map((x) => `${x.title} ${x.skin}% b${x.borde}`),
      },
    ]),
  );
  const value = { fecha: new Date().toISOString(), resumen };
  await db.insert(settings).values({ key: "fotos-analisis", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  return value;
}

