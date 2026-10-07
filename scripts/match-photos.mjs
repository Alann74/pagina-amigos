// Cruza el listado de fotos de Drive (data/drive-manifest.tsv) con los artículos del POS
// (data/pos-productos.csv) y genera data/photo-matches.json + data/REPORTE-FOTOS.md
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifest = fs.readFileSync(path.join(root, "data/drive-manifest.tsv"), "utf8").trim().split("\n").slice(1);
const csv = fs.readFileSync(path.join(root, "data/pos-productos.csv"), "utf8").trim().split("\n").slice(1);

const products = new Map();
for (const line of csv) {
  const [posId, art, nombre] = line.split(",");
  if (art) products.set(art, { art, nombre, posId: Number(posId) });
}

// dedupe: TODAS es la carpeta completa; la raíz tiene copias con el mismo nombre
const byTitle = new Map();
for (const line of manifest) {
  const [id, title, folder] = line.split("\t");
  const key = title.trim().toLowerCase();
  if (!byTitle.has(key) || folder === "TODAS") byTitle.set(key, { id, title: title.trim(), folder });
}
const files = [...byTitle.values()];

const COLOR_WORDS = /(?:_| )([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]*?)( ESP)?$/;
function classify(title) {
  const base = title.replace(/\.(jpe?g|png|webp)$/i, "");
  const clean = base.replace(/^_+/, "");
  const [primaryPart, setPart] = clean.split(/_SET CON /i);
  const codesIn = (s) => [...(s || "").matchAll(/(?<!\d)(3[5-9]\d{3})(?!\d)/g)].map((m) => m[1]);
  const primaryCodes = codesIn(primaryPart);
  const setCodes = codesIn(setPart);
  const allCodes = [...new Set([...primaryCodes, ...setCodes])];
  const known = allCodes.filter((c) => products.has(c));
  const unknown = allCodes.filter((c) => !products.has(c) && /^3[7-9]/.test(c));

  let kind = "campana";
  let order = 0;
  let color = null;
  let back = false;
  // foto de catálogo: "39603-2_BLANCO ESP", "39876 1", "39181", "39996 (4)", "39923 CHOCO"
  const cat = clean.match(/^(\d{5})(?:[- ](?:\()?(\d{1,2})(?:\))?)?(?:[_ ]([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]*?))?( ESP)?(?:\(\d\))?$/);
  if (cat && !/limpia/i.test(clean)) {
    kind = "catalogo";
    order = cat[2] ? Number(cat[2]) : 0;
    color = cat[3] ? cat[3].trim() : null;
    back = Boolean(cat[4]);
  } else if (primaryCodes.length + setCodes.length > 1 && known.length > 1) {
    kind = "look";
    const n = clean.match(/(\d{1,2})(?:_limpia)?(?:_\d)?$/i);
    order = n ? Number(n[1]) : 0;
  } else {
    const n = clean.match(/^(\d{1,2})/) || clean.match(/_P(\d{2})/i) || clean.match(/limpia_(\d)$/i);
    order = n ? Number(n[1]) : 0;
  }
  if (color === "CHOCO") color = "CHOCOLATE";
  if (color === "AZUL MARINO") color = "MARINO";
  return { kind, order, color, back, primary: primaryCodes.filter((c) => products.has(c)), known, unknown };
}

const KIND_RANK = { catalogo: 0, campana: 1, look: 2 };
const perProduct = new Map();
const orphanFiles = [];
let orphanCount = 0;
const unknownCodes = new Map();
for (const f of files) {
  const c = classify(f.title);
  for (const u of c.unknown) {
    if (!unknownCodes.has(u)) unknownCodes.set(u, []);
    unknownCodes.get(u).push(f.title);
  }
  if (c.known.length === 0) {
    if (c.unknown.length === 0) orphanFiles.push(f.title);
    else orphanCount++;
    continue;
  }
  for (const code of c.known) {
    const isPrimary = c.primary.includes(code) || c.known.length === 1;
    if (!perProduct.has(code)) perProduct.set(code, []);
    perProduct.get(code).push({ ...f, ...c, isPrimary });
  }
}

const result = {};
for (const [code, list] of perProduct) {
  list.sort((a, b) => {
    // catálogo sin color (toma general) → catálogo con color (frente, después espalda) → campaña → looks
    const ra = KIND_RANK[a.kind] * 10 + (a.kind === "catalogo" && a.color ? 1 : 0) + (a.isPrimary ? 0 : 5);
    const rb = KIND_RANK[b.kind] * 10 + (b.kind === "catalogo" && b.color ? 1 : 0) + (b.isPrimary ? 0 : 5);
    if (ra !== rb) return ra - rb;
    if (a.order !== b.order) return a.order - b.order;
    if (a.back !== b.back) return a.back ? 1 : -1;
    return a.title.localeCompare(b.title);
  });
  result[code] = list.map((x) => ({ driveId: x.id, title: x.title, kind: x.kind, color: x.color, back: x.back, look: x.kind === "look" ? x.known : undefined }));
}

fs.writeFileSync(path.join(root, "data/photo-matches.json"), JSON.stringify(result, null, 1));
// Para el reporte del admin: fotos cuyo artículo no está cargado (por si se agrega después)
const unmatched = Object.fromEntries([...unknownCodes.entries()].sort().map(([c, t]) => [c, t]));
fs.writeFileSync(path.join(root, "data/photo-unmatched.json"), JSON.stringify({ codes: unmatched, noCode: orphanFiles }, null, 1));

const withPhoto = [...products.keys()].filter((c) => result[c]);
const without = [...products.values()].filter((p) => !result[p.art]);
const noArt = csv.filter((l) => l.split(",")[1] === "").map((l) => l.split(",")[2]);
let md = `# Reporte de fotos (Drive → productos)\n\nGenerado por \`scripts/match-photos.mjs\`.\n\n`;
md += `- Fotos únicas en Drive (TODAS): **${files.length}**\n- Artículos del POS: **${products.size}** (+${noArt.length} sin número de artículo)\n- Artículos con foto: **${withPhoto.length}**\n- Artículos sin foto: **${without.length + noArt.length}**\n- Fotos sin producto (su código de artículo no está en el POS): **${orphanCount} archivos, ${unknownCodes.size} códigos**\n- Fotos sin código reconocible: **${orphanFiles.length}**\n\n`;
md += `## Productos sin foto\n\n| Art. | Producto |\n|---|---|\n` + without.map((p) => `| ${p.art} | ${p.nombre} |`).join("\n") + "\n" + noArt.map((n) => `| — | ${n} (sin artículo en POS) |`).join("\n") + "\n\n";
md += `## Fotos con artículo que no está en el POS\n\n| Art. | Archivos |\n|---|---|\n` + [...unknownCodes.entries()].sort().map(([c, t]) => `| ${c} | ${t.slice(0, 4).join("<br>")}${t.length > 4 ? `<br>(+${t.length - 4})` : ""} |`).join("\n") + "\n\n";
md += `## Fotos sin código reconocible\n\n` + (orphanFiles.length ? orphanFiles.map((t) => `- ${t}`).join("\n") : "Ninguna.") + "\n";
fs.writeFileSync(path.join(root, "data/REPORTE-FOTOS.md"), md);
console.log({ files: files.length, products: products.size, withPhoto: withPhoto.length, without: without.length, unknownCodes: unknownCodes.size, orphanFilesNoCode: orphanFiles.length, orphanCount });
