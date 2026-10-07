import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyPhoto, compareRank, photoRank, sameShotKey } from "../../src/lib/photo-classify";

test("clasifica por el nombre del archivo", () => {
  assert.equal(classifyPhoto("__7-39603_limpia.jpg")?.kind, "campana");
  assert.equal(classifyPhoto("39606 1_limpia.jpg")?.kind, "campana");
  assert.equal(classifyPhoto("39606 1.jpg")?.kind, "modelo");
  assert.equal(classifyPhoto("39603-1.jpg")?.kind, "modelo");
  assert.deepEqual(classifyPhoto("39603-2_BLANCO.png"), { kind: "catalogo", order: 2, color: "BLANCO", back: false, codes: ["39603"], primary: ["39603"] });
  assert.equal(classifyPhoto("39603-3_BLANCO ESP.png")?.back, true);
  assert.equal(classifyPhoto("39269 CHOCO ESP.png")?.color, "CHOCOLATE");
  // PNG numerada sin color: la de la modelo en el catálogo (se confirma mirando la foto)
  assert.equal(classifyPhoto("39200-1.png")?.kind, "modelo");
  assert.equal(classifyPhoto("39200-1.png")?.dudosa, true);
  // Copias hechas en Drive: misma clasificación y misma toma
  assert.deepEqual(classifyPhoto("Copia de 39907-2_BLANCO.png"), classifyPhoto("39907-2_BLANCO.png"));
  assert.equal(classifyPhoto("Copia de 39907-2_BLANCO.png")?.kind, "catalogo");
  assert.equal(sameShotKey("Copia de 39405-1.png"), sameShotKey("39405-1.png"));
  assert.equal(sameShotKey("39405-1 (1).png"), sameShotKey("39405-1.png"));
  assert.equal(classifyPhoto("39164 39863 11.jpg")?.kind, "look");
  assert.deepEqual(classifyPhoto("__17.A-39864_SET CON 39865_limpia.jpg")?.primary, ["39864"]);
  assert.equal(classifyPhoto("Portada_Reel.jpg"), null);
});

test("orden: modelo primero, después la prenda sola (frente y espalda)", () => {
  const titles = ["39603-3_BLANCO ESP.png", "39603-2_BLANCO.png", "39603 4.jpg", "__7-39603_limpia.jpg", "39603 39419 2.jpg"];
  const sorted = titles.map((t) => ({ t, r: photoRank(classifyPhoto(t)!, "39603") })).sort((a, b) => compareRank(a.r, b.r)).map((x) => x.t);
  assert.deepEqual(sorted, ["__7-39603_limpia.jpg", "39603 4.jpg", "39603 39419 2.jpg", "39603-2_BLANCO.png", "39603-3_BLANCO ESP.png"]);
  assert.equal(sameShotKey("39606 1_limpia.jpg"), sameShotKey("39606 1.jpg"));
});

test("orden con la foto de la modelo del catálogo (PNG sin color)", () => {
  const titles = ["39405-3_GRAFITO ESP.png", "39405-2_GRAFITO.png", "__9-39405-35037_limpia.png", "39405-1.png", "39405-4_BLANCO.png"];
  const sorted = titles.map((t) => ({ t, r: photoRank(classifyPhoto(t)!, "39405") })).sort((a, b) => compareRank(a.r, b.r)).map((x) => x.t);
  assert.deepEqual(sorted, ["39405-1.png", "__9-39405-35037_limpia.png", "39405-2_GRAFITO.png", "39405-3_GRAFITO ESP.png", "39405-4_BLANCO.png"]);
});

test("prenda sola: sin piel y con borde blanco", async () => {
  const { looksLikeFlat } = await import("../../src/lib/photo-order");
  assert.equal(looksLikeFlat({ skin: 0, borde: 100 }), true);
  assert.equal(looksLikeFlat({ skin: 65.8, borde: 50 }), false);
  assert.equal(looksLikeFlat({ skin: 1, borde: 40 }), false);
});

test("huella: la misma foto sí, otro color o la espalda no", async () => {
  const sharp = (await import("sharp")).default;
  const { imageHash, isSamePhoto } = await import("../../src/lib/media");
  // Prenda: rectángulo de color sobre fondo blanco; espalda = otra forma (con un "escote")
  const garment = async (color: string, back = false, jpeg = false) => {
    const svg = `<svg width="300" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="400" fill="#fff"/><rect x="60" y="60" width="180" height="300" fill="${color}"/>${back ? "" : '<circle cx="150" cy="60" r="40" fill="#fff"/>'}</svg>`;
    const img = sharp(Buffer.from(svg));
    return jpeg ? img.jpeg({ quality: 70 }).toBuffer() : img.webp({ quality: 85 }).toBuffer();
  };
  const negro = await imageHash(await garment("#151515"));
  // La misma foto vuelta a guardar (otro tamaño de origen, mismo proceso)
  const negroOtraVez = await imageHash(await sharp(await garment("#151515")).resize(600, 800).webp({ quality: 80 }).toBuffer());
  const choco = await imageHash(await garment("#4a2c20"));
  const crudo = await imageHash(await garment("#f2ece0"));
  const blanco = await imageHash(await garment("#fbfbfb"));
  const espalda = await imageHash(await garment("#151515", true));
  assert.equal(isSamePhoto(negro, negroOtraVez), true);
  assert.equal(isSamePhoto(negro, choco), false);
  assert.equal(isSamePhoto(crudo, blanco), false);
  assert.equal(isSamePhoto(negro, espalda), false);
});

test("conjunto de dos artículos: prenda sola y a qué artículo va cada foto", async () => {
  const flat = classifyPhoto("39001-39400 5_CHOCO.png");
  assert.equal(flat?.kind, "catalogo");
  assert.equal(flat?.order, 5);
  assert.equal(classifyPhoto("39705 39417-4_NEGRO ESP.png")?.back, true);
  assert.equal(classifyPhoto("39018-39419 3.png")?.dudosa, true);
  assert.equal(classifyPhoto("39001-39400 1.jpg")?.kind, "look");
  // sin número: después de las numeradas
  assert.equal(classifyPhoto("39606 NEGRO ESP.png")?.order, 50);
  const { photoBelongs, chosenMainPhoto } = await import("../../src/lib/photo-scope");
  assert.equal(photoBelongs("39001-39400 3_CHOCO.png", "39001"), true);
  assert.equal(photoBelongs("39001-39400 5_CHOCO.png", "39001"), false);
  assert.equal(photoBelongs("Copia de 39001-39400 5_CHOCO.png", "39400"), true);
  // SET CON: solo en el artículo principal
  assert.equal(photoBelongs("__14.B-AP_37262_SET CON 37261_limpia.jpg", "37262"), true);
  assert.equal(photoBelongs("__14.B-AP_37262_SET CON 37261_limpia.jpg", "37261"), false);
  assert.equal(photoBelongs("__1.A-39700-21087 BIS_SET CON 39401 Y 39701_limpia.jpg", "39401"), false);
  // revisadas a ojo: en la campera no va la foto donde solo se ven los jeans
  assert.equal(photoBelongs("39864 39865 41.jpg", "39864"), false);
  assert.equal(photoBelongs("39864 39865 41.jpg", "39865"), true);
  assert.equal(photoBelongs("39603-2_BLANCO.png", "39603"), true);
  assert.equal(chosenMainPhoto("39988"), "39988 1.png");
});
