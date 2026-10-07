// Clasificación de las fotos de Drive por el nombre del archivo (el código de artículo de 5 cifras manda).
// Orden en la ficha (pedido de INEDITA):
//   1) la mejor foto de la modelo con la prenda (campaña "_limpia", la de número más bajo)
//   2) otras fotos de la modelo (más campaña, tomas "39606 3.jpg", conjuntos "SET CON" / "39164 39863 11.jpg")
//   3) la prenda sola, en el aire o fondo limpio ("39603-2_BLANCO.png", frente y después espalda "ESP")
//   4) detalles (si el nombre dice detalle, zoom o textura)

export type PhotoKind = "campana" | "modelo" | "look" | "catalogo" | "detalle";

export type ClassifiedPhoto = {
  kind: PhotoKind;
  order: number;
  color: string | null;
  back: boolean;
  codes: string[]; // todos los artículos que aparecen en el nombre
  primary: string[]; // los de la prenda principal (antes de "SET CON")
};

const COLOR_FIX: Record<string, string> = { CHOCO: "CHOCOLATE", "AZUL MARINO": "MARINO", OLIVIA: "OLIVA" };

export function classifyPhoto(title: string): ClassifiedPhoto | null {
  const ext = (title.match(/\.(jpe?g|png|webp|heic)$/i)?.[1] ?? "").toLowerCase();
  const clean = title.replace(/\.(jpe?g|png|webp|heic)$/i, "").replace(/^_+/, "").trim();
  const [primaryPart, setPart] = clean.split(/_SET CON /i);
  const codesIn = (s?: string) => [...(s ?? "").matchAll(/(?<!\d)(3[5-9]\d{3}|4\d{4})(?!\d)/g)].map((m) => m[1]);
  const primary = [...new Set(codesIn(primaryPart))];
  const codes = [...new Set([...primary, ...codesIn(setPart)])];
  if (codes.length === 0) return null;

  if (/detalle|zoom|textura|close/i.test(clean)) return { kind: "detalle", order: Number(clean.match(/(\d{1,2})$/)?.[1] ?? 0), color: null, back: false, codes, primary };

  // Prenda sola: "39603-2_BLANCO ESP", "39923 CHOCO", "39269 CHOCO ESP", "39200-1" en PNG
  const cat = clean.match(/^(\d{5})(?:[- ](?:\()?(\d{1,2})(?:\))?)?(?:[_ ]([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]*?))?( ESP)?(?:\(\d\))?$/);
  if (cat && !/limpia/i.test(clean)) {
    const colorRaw = cat[3]?.trim() ?? null;
    const color = colorRaw ? (COLOR_FIX[colorRaw] ?? colorRaw) : null;
    const back = Boolean(cat[4]);
    const order = cat[2] ? Number(cat[2]) : 0;
    // JPG numerado sin color ("39606 1.jpg"): toma de la sesión de fotos, con modelo
    if (ext !== "png" && !color && !back) return { kind: "modelo", order, color: null, back: false, codes, primary };
    return { kind: "catalogo", order, color, back, codes, primary };
  }
  // Varias prendas en la foto: conjunto con modelo
  if (codes.length > 1) {
    const n = clean.match(/(\d{1,2})(?:_limpia)?(?:_\d)?$/i);
    return { kind: "look", order: n ? Number(n[1]) : 0, color: null, back: false, codes, primary };
  }
  // Campaña: "__7-39603_limpia", "39606 1_limpia", "AP_39886_limpia"
  const n = clean.match(/^(\d{1,2})-/) ?? clean.match(/ (\d{1,2})_limpia/i) ?? clean.match(/_P(\d{2})/i) ?? clean.match(/limpia_(\d)$/i);
  return { kind: /limpia/i.test(clean) ? "campana" : "modelo", order: n ? Number(n[1]) : 0, color: null, back: false, codes, primary };
}

const RANK: Record<PhotoKind, number> = { campana: 0, modelo: 1, look: 2, catalogo: 3, detalle: 4 };

/** Orden de las fotos de un artículo según el pedido de INEDITA. */
export function photoRank(p: ClassifiedPhoto, article: string): number[] {
  const isPrimary = p.primary.includes(article) || p.codes.length === 1;
  return [
    isPrimary ? 0 : 1, // primero las fotos donde la prenda es la principal
    RANK[p.kind],
    p.kind === "catalogo" && p.color ? 1 : 0,
    p.order,
    p.back ? 1 : 0,
  ];
}

export function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
}

/** Misma toma con dos nombres: "39606 1.jpg" y "39606 1_limpia.jpg" → se queda la "limpia". */
export function sameShotKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\.(jpe?g|png|webp|heic)$/i, "")
    .replace(/_limpia$/i, "")
    .trim();
}
