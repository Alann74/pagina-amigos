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
  assert.equal(classifyPhoto("39200-1.png")?.kind, "catalogo");
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
