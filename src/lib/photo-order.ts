import { createHash } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, productImages, products, settings } from "@/db/schema";
import { photoFeatures } from "@/lib/photo-analysis";
import { baseTitle, classifyPhoto, compareRank, photoRank } from "@/lib/photo-classify";
import { chosenMainPhoto, scopeRules } from "@/lib/photo-scope";

// Orden de las fotos de cada producto, según el pedido de INEDITA: modelo → otras de la modelo →
// prenda sola (frente y espalda por color) → detalles. Se ordena lo que el producto tiene de verdad
// (no la lista de Drive), y solo cuando cambian sus fotos: si alguien las ordenó a mano en el panel,
// ese orden se respeta y las nuevas van al final.

const KEY = "orden-fotos-v2";

type State = {
  fecha?: string;
  cambios?: number;
  firmas: Record<string, string>; // producto → fotos que tenía la última vez que se ordenó
  manual: number[]; // productos ordenados a mano en el panel
  vista: Record<string, "modelo" | "prenda">; // fotos que se miraron para confirmar si está la modelo
  reglas?: string; // si cambian las reglas de orden, se vuelve a ordenar todo (salvo lo ordenado a mano)
};

// Cambia cuando cambia la forma de ordenar o las principales elegidas a mano
const RULES = createHash("sha1").update(`clasificacion-2026-10-07b|${JSON.stringify(scopeRules)}`).digest("hex").slice(0, 12);

async function getState(): Promise<State> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, KEY) });
  const v = (row?.value ?? {}) as Partial<State>;
  return { ...v, firmas: v.firmas ?? {}, manual: v.manual ?? [], vista: v.vista ?? {} };
}

async function saveState(state: State) {
  await db.insert(settings).values({ key: KEY, value: state }).onConflictDoUpdate({ target: settings.key, set: { value: state } });
}

/** El panel ordenó las fotos de este producto a mano: no se vuelven a ordenar solas. */
export async function markManualOrder(productId: number) {
  const state = await getState();
  if (state.manual.includes(productId)) return;
  state.manual.push(productId);
  await saveState(state);
}

/** Prenda sola sobre fondo blanco: casi sin piel y el borde blanco. */
export function looksLikeFlat(f: { skin: number; borde: number }): boolean {
  return f.skin < 3 && f.borde >= 95;
}

type Row = { id: number; productId: number; article: string | null; title: string | null; sortOrder: number; key: string | null };

const signature = (list: Row[]) =>
  createHash("sha1")
    .update(
      list
        .map((i) => i.id)
        .sort((a, b) => a - b)
        .join(","),
    )
    .digest("hex")
    .slice(0, 12);

/** Ordena las fotos de los productos cuyas fotos cambiaron (o de los indicados). Devuelve cuántas se movieron. */
export async function syncPhotoOrder(only?: number[]): Promise<number> {
  const state = await getState();
  const manual = new Set(state.manual);
  const rows: Row[] = await db
    .select({ id: productImages.id, productId: productImages.productId, article: products.articleCode, title: productImages.sourceName, sortOrder: productImages.sortOrder, key: productImages.blobPath })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(only?.length ? inArray(productImages.productId, only) : undefined);
  const byProduct = new Map<number, Row[]>();
  for (const r of rows) byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r]);
  const rulesChanged = state.reglas !== RULES;
  const pending = [...byProduct.entries()].filter(([id, list]) => rulesChanged || state.firmas[id] !== signature(list) || list.some((i) => i.sortOrder >= 1000));

  // Las "dudosas" por nombre (PNG numerada sin color) se miran una vez: piel visible y fondo
  const toLook = pending.flatMap(([, list]) => list).filter((i) => i.key && !state.vista[i.key] && classifyPhoto(i.title ?? "")?.dudosa);
  for (let k = 0; k < toLook.length; k += 20) {
    const part = toLook.slice(k, k + 20);
    const data = await db.select({ key: media.key, data: media.data }).from(media).where(inArray(media.key, part.map((i) => i.key!)));
    for (const d of data) {
      const f = await photoFeatures(d.data).catch(() => null);
      if (f) state.vista[d.key] = looksLikeFlat(f) ? "prenda" : "modelo";
    }
  }

  const changes: [number, number][] = [];
  for (const [productId, list] of pending) {
    const rank = (i: Row) => {
      const c = classifyPhoto(i.title ?? "");
      if (!c) return [9];
      if (c.dudosa && i.key && state.vista[i.key] === "prenda") c.kind = "catalogo";
      return photoRank(c, i.article ?? "");
    };
    const byRank = (a: Row, b: Row) => compareRank(rank(a), rank(b)) || baseTitle(a.title ?? "").localeCompare(baseTitle(b.title ?? "")) || a.id - b.id;
    let ordered = manual.has(productId)
      ? [...list.filter((i) => i.sortOrder < 1000).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id), ...list.filter((i) => i.sortOrder >= 1000).sort(byRank)]
      : [...list].sort(byRank);
    // Principal elegida a mano en data/fotos-articulo.json
    const chosen = !manual.has(productId) && list[0]?.article ? chosenMainPhoto(list[0].article) : undefined;
    const main = chosen ? ordered.find((i) => i.title && baseTitle(i.title).toLowerCase() === chosen.toLowerCase()) : undefined;
    if (main) ordered = [main, ...ordered.filter((i) => i !== main)];
    ordered.forEach((img, pos) => {
      if (img.sortOrder !== pos) changes.push([img.id, pos]);
    });
    state.firmas[productId] = signature(list);
  }
  for (let i = 0; i < changes.length; i += 300) {
    const part = changes.slice(i, i + 300);
    await db.execute(
      sql`update product_images pi set sort_order = v.pos from (values ${sql.join(
        part.map(([id, pos]) => sql`(${id}::int, ${pos}::int)`),
        sql`, `,
      )}) as v(id, pos) where pi.id = v.id`,
    );
  }
  // Si se ordenaron solo algunos productos, las reglas nuevas quedan pendientes para el resto
  if (!only?.length) state.reglas = RULES;
  state.fecha = new Date().toISOString();
  state.cambios = changes.length;
  await saveState(state);
  return changes.length;
}
