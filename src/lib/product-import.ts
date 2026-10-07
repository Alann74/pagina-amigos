// Lista de productos nuevos (Excel/CSV): artículo, nombre y precio minorista; opcionales categoría,
// colores y talles. Lo que no viene se deduce del nombre (categoría) y de la categoría (talles).
import { normalizeName, parseMoneyLoose, type Cell } from "@/lib/wholesale-import";

export type NewProductRow = { code: string; name: string; price: number; category: string | null; colors: string[]; sizes: string[] };

const CATEGORY_BY_WORD: [RegExp, string][] = [
  [/^(remera)/, "Remeras"],
  [/^(musculosa)/, "Musculosas"],
  [/^(top|strapless)/, "Tops"],
  [/^(body)/, "Bodies"],
  [/^(blusa)/, "Blusas"],
  [/^(camisa)/, "Camisas"],
  [/^(vestido)/, "Vestidos"],
  [/^(mono|enterito)/, "Monos"],
  [/^(wide leg|straight|oxford|carrot|recto|campanita|jean|denim|mom|baggy)/, "Jeans"],
  [/^(pantalon|babucha|palazzo|jogger)/, "Pantalones"],
  [/^(short)/, "Shorts"],
  [/^(bermuda)/, "Bermudas"],
  [/^(pollera|mini|falda)/, "Polleras"],
  [/^(sweater|cardigan|sueter)/, "Sweaters"],
  [/^(buzo|hoodie)/, "Buzos"],
  [/^(blazer|saco)/, "Blazers"],
  [/^(campera|chaqueta)/, "Camperas"],
  [/^(piloto|trench)/, "Pilotos"],
  [/^(chaleco)/, "Chalecos"],
  [/^(cartera|bolso|bandolera|mochila)/, "Carteras"],
  [/^(gorra|faja|cinturon|cinto|pañuelo|panuelo|pashmina|lentes|aros|collar)/, "Accesorios"],
];

export function guessCategory(name: string): string | null {
  const n = normalizeName(name);
  for (const [re, cat] of CATEGORY_BY_WORD) if (re.test(n)) return cat;
  return null;
}

export function defaultSizes(category: string | null): string[] {
  if (category === "Jeans") return ["24", "26", "28", "30", "32", "34", "36"];
  if (category === "Carteras" || category === "Accesorios") return ["UNICO"];
  return ["S", "M", "L", "XL"];
}

const text = (c: Cell) => (c === null || c === undefined ? "" : String(c).trim());
const list = (v: string) =>
  v
    .split(/[|/,;]| - /)
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);

export function parseProductTable(rows: Cell[][]): NewProductRow[] {
  const isHeader = (r: Cell[]) => r.some((c) => /^(art(i|í)culo|art\.?|c(o|ó)digo|cod\.?)$/i.test(text(c)));
  const hi = rows.findIndex(isHeader);
  const header = hi >= 0 ? rows[hi].map((c) => text(c).toLowerCase()) : [];
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  let codeCol = col(/^(art(i|í)culo|art\.?|c(o|ó)digo|cod\.?)$/);
  let nameCol = col(/nombre|descrip|producto|prenda|modelo/);
  let priceCol = col(/precio|minorista|valor|importe|\$/);
  const catCol = col(/categor/);
  const colorCol = col(/color/);
  const sizeCol = col(/talle/);
  const body = hi >= 0 ? rows.slice(hi + 1) : rows;
  const width = Math.max(0, ...body.map((r) => r.length));
  const best = (score: (c: number) => number, skip: number[]) => {
    let pick = -1;
    let top = 0;
    for (let c = 0; c < width; c++) {
      if (skip.includes(c)) continue;
      const s = score(c);
      if (s > top) [top, pick] = [s, c];
    }
    return pick;
  };
  if (codeCol < 0) codeCol = best((c) => body.filter((r) => /^\d{5}$/.test(text(r[c]))).length, []);
  if (priceCol < 0) priceCol = best((c) => body.filter((r) => parseMoneyLoose(r[c]) !== null && !/^\d{5}$/.test(text(r[c]))).length, [codeCol]);
  if (nameCol < 0) nameCol = best((c) => body.filter((r) => /[a-záéíóúñ]{3}/i.test(text(r[c]))).length, [codeCol, priceCol, catCol, colorCol, sizeCol]);
  const out: NewProductRow[] = [];
  for (const r of body) {
    const code = text(r[codeCol]).match(/(?<!\d)(\d{5})(?!\d)/)?.[1];
    const name = nameCol >= 0 ? text(r[nameCol]).replace(/\s+/g, " ") : "";
    const price = priceCol >= 0 ? parseMoneyLoose(r[priceCol]) : null;
    if (!code || !name || !price) continue;
    const category = (catCol >= 0 && text(r[catCol])) || guessCategory(name);
    const sizes = sizeCol >= 0 && text(r[sizeCol]) ? list(text(r[sizeCol])) : defaultSizes(category);
    out.push({ code, name, price, category, colors: colorCol >= 0 ? list(text(r[colorCol])) : [], sizes });
  }
  return out;
}

/** "PANTALON CITRUS" → "Pantalón Citrus" (los nombres del POS vienen en mayúsculas). */
export function prettyProductName(name: string): string {
  const t = name.trim().replace(/\s+/g, " ");
  const titled = t === t.toUpperCase() ? t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, s, l) => s + l.toUpperCase()) : t;
  return titled.replace(/^Pantalon\b/, "Pantalón").replace(/\bCinturon\b/, "Cinturón");
}
