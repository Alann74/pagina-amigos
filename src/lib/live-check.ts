import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productImages, products, settings } from "@/db/schema";

// Verificación de la tienda publicada (la versión en línea, desde afuera): el catálogo y las fichas
// tienen que traer las fotos, y cada foto tiene que bajar bien como la pide un navegador.

const WEBP = /-w\d+\.webp$/;

async function get(url: string) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" }, signal: AbortSignal.timeout(30_000) });
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, type: r.headers.get("content-type") ?? "", bytes: buf.length, ms: Date.now() - t0, cache: r.headers.get("x-vercel-cache") ?? "" };
  } catch (e) {
    return { status: 0, type: e instanceof Error ? e.message.slice(0, 60) : "error", bytes: 0, ms: Date.now() - t0, cache: "" };
  }
}

export async function liveCheck(base: string) {
  const report: Record<string, unknown> = { fecha: new Date().toISOString(), base };
  // Páginas: que respondan y traigan fotos servidas por /m/
  const paginas: Record<string, unknown>[] = [];
  const slugs = await db.select({ slug: products.slug }).from(products).where(eq(products.visible, true)).limit(4);
  for (const path of ["/", "/productos", "/categoria/vestidos", ...slugs.map((s) => `/producto/${s.slug}`)]) {
    const t0 = Date.now();
    try {
      const r = await fetch(base + path, { signal: AbortSignal.timeout(30_000) });
      const html = await r.text();
      const fotos = [...html.matchAll(/(?:src|srcSet|srcset)="([^"]+)"/g)].flatMap((m) => m[1].split(",").map((x) => x.trim().split(" ")[0])).filter((u) => /\/m\/|blob\.vercel-storage/.test(u));
      paginas.push({ path, status: r.status, ms: Date.now() - t0, fotosM: fotos.filter((u) => u.includes("/m/")).length, fotosBlob: fotos.filter((u) => u.includes("blob.vercel-storage")).length });
    } catch (e) {
      paginas.push({ path, error: e instanceof Error ? e.message : String(e) });
    }
  }
  report.paginas = paginas;

  // Todas las fotos: el tamaño que piden los celulares (800) y, de una muestra, 400/1200/JPG
  const rows = await db.select({ url: productImages.url }).from(productImages);
  const jobs: string[] = [];
  rows.forEach((r, i) => {
    if (!WEBP.test(r.url)) return;
    jobs.push(r.url.replace(WEBP, "-w800.webp"));
    if (i % 10 === 0) jobs.push(r.url.replace(WEBP, "-w400.webp"), r.url.replace(WEBP, "-w1200.webp"), r.url.replace(WEBP, "-share.jpg"));
  });
  const fallas: Record<string, unknown>[] = [];
  let ok = 0;
  let total = 0;
  let ms = 0;
  let i = 0;
  await Promise.all(
    Array.from({ length: 12 }, async () => {
      while (i < jobs.length) {
        const u = jobs[i++];
        const r = await get(base + u);
        total++;
        ms += r.ms;
        const good = r.status === 200 && (u.endsWith(".jpg") ? r.type.includes("jpeg") : r.type.includes("webp")) && r.bytes > 500;
        if (good) ok++;
        else fallas.push({ u, ...r });
      }
    }),
  );
  report.fotos = { pedidas: total, ok, fallas: fallas.length, promedioMs: total ? Math.round(ms / total) : 0, ejemplos: fallas.slice(0, 20) };
  await db.insert(settings).values({ key: "verificacion-en-vivo", value: report }).onConflictDoUpdate({ target: settings.key, set: { value: report } });
  return report;
}
