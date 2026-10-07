// Lectura de la planilla de precios por mayor (Excel, CSV o Google Sheets). Acepta el formato de
// "PRECIOS POR MAYOR 2027 INEDITA": título arriba, columnas ARTICULO · NOMBRE · precio ("$33,000").

export type Cell = string | number | boolean | Date | null | undefined;
export type PriceRow = { code: string | null; name: string; price: number };

/** "$33,000" · "33.000" · "$ 33.000,00" · 33000 → 33000 */
export function parseMoneyLoose(value: Cell): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  if (typeof value !== "string") return null;
  const s = value.replace(/[$\s]|ARS/gi, "");
  if (!s || !/\d/.test(s) || /[^\d.,]/.test(s)) return null;
  let n: number;
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) n = Number(s.replace(/[.,]/g, ""));
  else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) n = Number(s.replace(/\./g, "").replace(",", "."));
  else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) n = Number(s.replace(/,/g, ""));
  else if (/^\d+([.,]\d{1,2})?$/.test(s)) n = Number(s.replace(",", "."));
  else return null;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

const text = (c: Cell) => (c === null || c === undefined ? "" : String(c).trim());
const articleIn = (c: Cell) => text(c).match(/(?<!\d)(\d{5})(?!\d)/)?.[1] ?? null;

export function parsePriceTable(rows: Cell[][]): PriceRow[] {
  const headerIndex = rows.findIndex((r) => r.some((c) => /^(art(i|í)culo|art\.?|c(o|ó)digo|cod\.?)$/i.test(text(c))));
  let codeCol = -1;
  let nameCol = -1;
  let priceCol = -1;
  if (headerIndex >= 0) {
    const header = rows[headerIndex].map(text);
    codeCol = header.findIndex((h) => /^(art(i|í)culo|art\.?|c(o|ó)digo|cod\.?)$/i.test(h));
    nameCol = header.findIndex((h) => /nombre|descrip|producto|prenda|modelo/i.test(h));
    priceCol = header.findIndex((h) => /precio|mayor|valor|importe|\$/i.test(h));
  }
  const body = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;
  const width = Math.max(0, ...body.map((r) => r.length));
  if (codeCol < 0) {
    // Sin encabezado: la columna con más códigos de 5 dígitos
    let best = 0;
    for (let c = 0; c < width; c++) {
      const hits = body.filter((r) => articleIn(r[c]) && text(r[c]).length <= 8).length;
      if (hits > best) [best, codeCol] = [hits, c];
    }
  }
  if (priceCol < 0) {
    // La columna (que no sea la del código) donde más celdas son importes
    let best = 0;
    for (let c = 0; c < width; c++) {
      if (c === codeCol) continue;
      const hits = body.filter((r) => parseMoneyLoose(r[c]) !== null).length;
      if (hits > best) [best, priceCol] = [hits, c];
    }
  }
  if (nameCol < 0) {
    let best = 0;
    for (let c = 0; c < width; c++) {
      if (c === codeCol || c === priceCol) continue;
      const hits = body.filter((r) => /[a-záéíóúñ]{3}/i.test(text(r[c]))).length;
      if (hits > best) [best, nameCol] = [hits, c];
    }
  }
  if (priceCol < 0) return [];
  const out: PriceRow[] = [];
  for (const r of body) {
    const price = parseMoneyLoose(r[priceCol]);
    if (!price) continue;
    const code = codeCol >= 0 ? articleIn(r[codeCol]) : null;
    const name = nameCol >= 0 ? text(r[nameCol]) : "";
    if (!code && !name) continue;
    out.push({ code, name, price });
  }
  return out;
}

/** CSV simple (coma, punto y coma o tabulación; con comillas) → filas */
export function csvToRows(input: string): Cell[][] {
  const textIn = input.replace(/^﻿/, "");
  const firstLine = textIn.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: Cell[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < textIn.length; i++) {
    const ch = textIn[i];
    if (quoted) {
      if (ch === '"' && textIn[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && textIn[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export const normalizeName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
