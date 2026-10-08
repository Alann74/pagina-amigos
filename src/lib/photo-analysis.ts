import { eq, inArray, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { media, productImages, settings } from "@/db/schema";
import { classifyPhoto } from "@/lib/photo-classify";

// Control del clasificador sin mirar las fotos: % de píxeles con tono de piel y % de borde blanco.
// Una foto con modelo tiene piel visible; la prenda sola, casi nada y el borde blanco.

export async function photoFeatures(data: Buffer) {
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

// Rasgos ya calculados por foto (la clave cambia si cambia la foto): así cada deploy solo baja de la base
// las fotos nuevas y no las 900 enteras (eso gastaba la transferencia mensual de Neon).
const FEATURES_KEY = "fotos-analisis-rasgos";

export async function classificationReport() {
  const rows = await db
    .select({ title: productImages.sourceName, key: media.key })
    .from(productImages)
    .innerJoin(media, sql`${media.key} = ${productImages.blobPath}`);
  const saved = ((await db.query.settings.findFirst({ where: eq(settings.key, FEATURES_KEY) }))?.value ?? {}) as Record<string, [number, number]>;
  const current = new Set(rows.map((r) => r.key));
  const features: Record<string, [number, number]> = Object.fromEntries(Object.entries(saved).filter(([k]) => current.has(k)));
  const missing = [...current].filter((k) => !features[k]);
  for (let k = 0; k < missing.length; k += 20) {
    const part = await db.select({ key: media.key, data: media.data }).from(media).where(inArray(media.key, missing.slice(k, k + 20)));
    for (const d of part) {
      const f = await photoFeatures(d.data).catch(() => null);
      if (f) features[d.key] = [f.skin, f.borde];
    }
  }
  if (missing.length || Object.keys(saved).length !== Object.keys(features).length) {
    await db.insert(settings).values({ key: FEATURES_KEY, value: features }).onConflictDoUpdate({ target: settings.key, set: { value: features } });
  }
  const byKind = new Map<string, { title: string; skin: number; borde: number }[]>();
  for (const r of rows) {
    const c = r.title ? classifyPhoto(r.title) : null;
    const kind = c ? `${c.kind}${c.dudosa ? "-dudosa" : ""}${r.title && /\.png$/i.test(r.title) ? "-png" : "-jpg"}` : "sin-nombre";
    const v = features[r.key];
    if (!v) continue;
    const f = { skin: v[0], borde: v[1] };
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
  const value = { fecha: new Date().toISOString(), nuevas: missing.length, resumen };
  await db.insert(settings).values({ key: "fotos-analisis", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  return value;
}

