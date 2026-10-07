import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { products, settings } from "@/db/schema";
import { listPublicFolder, type DriveEntry } from "@/lib/drive-folder";
import type { DriveMatch } from "@/lib/drive-import";
import { classifyPhoto, compareRank, photoRank, sameShotKey } from "@/lib/photo-classify";

// Búsqueda de fotos en las carpetas de Drive de Temporada 3 (compartidas con "cualquiera con el enlace").
// Cada foto va a los artículos cuyo código figura en el nombre del archivo; las repetidas por nombre se
// descartan acá y las repetidas por contenido, al importarlas.

export const PHOTO_FOLDERS = [
  { id: "1DAWlthDwVh0aKYfG8S2TitWdGhDPHdhI", nombre: "Capsulas INEDITA / CAPSULAS FOTOS SOLAS" },
  { id: "11Fhw_weCSbFMdp8dHj67DlkcpYR3NPJg", nombre: "FOTOS DE CAPSULAS LIMPIAS / TODAS" },
  { id: "1OONS8nEyZYsW1O4oOTfk4OWj819bxBgi", nombre: "FOTOS DE CAPSULAS LIMPIAS" },
];

const IMAGE = /\.(jpe?g|png|webp|heic)$/i;
const KEY = "fotos-drive";

type Discovery = {
  fecha: string;
  carpetas: { nombre: string; archivos: number; error?: string }[];
  fotos: number;
  articulos: number;
  sinFoto: string[]; // artículos de la lista sin ninguna foto en Drive
  sinModelo: string[]; // artículos que solo tienen fotos de la prenda sola (la principal es la de la prenda)
  matches: Record<string, DriveMatch[]>;
};

export async function discoverDrivePhotos(): Promise<Discovery> {
  const known = new Set((await db.select({ code: products.articleCode }).from(products).where(isNotNull(products.articleCode))).map((p) => p.code!));
  const carpetas: Discovery["carpetas"] = [];
  const files: DriveEntry[] = [];
  const seen = new Set<string>();
  const walk = async (id: string, nombre: string, depth: number) => {
    try {
      const entries = await listPublicFolder(id);
      carpetas.push({ nombre, archivos: entries.filter((e) => !e.folder).length });
      for (const e of entries) {
        if (e.folder && depth < 2) await walk(e.id, `${nombre} / ${e.title}`, depth + 1);
        else if (!e.folder && IMAGE.test(e.title) && !seen.has(e.id)) {
          seen.add(e.id);
          files.push(e);
        }
      }
    } catch (err) {
      carpetas.push({ nombre, archivos: 0, error: err instanceof Error ? err.message : String(err) });
    }
  };
  for (const f of PHOTO_FOLDERS) await walk(f.id, f.nombre, 0);

  // Mismo nombre en dos carpetas → una sola. Misma toma con y sin "_limpia" → la limpia.
  const byTitle = new Map<string, DriveEntry>();
  for (const f of files) if (!byTitle.has(f.title.toLowerCase())) byTitle.set(f.title.toLowerCase(), f);
  const byShot = new Map<string, DriveEntry>();
  for (const f of byTitle.values()) {
    const key = sameShotKey(f.title);
    const prev = byShot.get(key);
    if (!prev || (/_limpia/i.test(f.title) && !/_limpia/i.test(prev.title))) byShot.set(key, f);
  }

  const perArticle = new Map<string, { m: DriveMatch; rank: number[] }[]>();
  for (const f of byShot.values()) {
    const c = classifyPhoto(f.title);
    if (!c) continue;
    for (const code of c.codes.filter((x) => known.has(x))) {
      const m: DriveMatch = { driveId: f.id, title: f.title, kind: c.kind, color: c.color, back: c.back, look: c.codes.length > 1 ? c.codes.filter((x) => known.has(x)) : undefined };
      perArticle.set(code, [...(perArticle.get(code) ?? []), { m, rank: photoRank(c, code) }]);
    }
  }
  const matches: Record<string, DriveMatch[]> = {};
  for (const [code, list] of perArticle) matches[code] = list.sort((a, b) => compareRank(a.rank, b.rank) || a.m.title.localeCompare(b.m.title)).map((x) => x.m);
  const conModelo = (list: DriveMatch[]) => list.some((m) => m.kind === "campana" || m.kind === "modelo" || m.kind === "look");
  const result: Discovery = {
    fecha: new Date().toISOString(),
    carpetas,
    fotos: byShot.size,
    articulos: Object.keys(matches).length,
    sinFoto: [...known].filter((c) => !matches[c]).sort(),
    sinModelo: Object.entries(matches)
      .filter(([, l]) => !conModelo(l))
      .map(([c]) => c)
      .sort(),
    matches,
  };
  // Solo se guarda si la búsqueda anduvo (si Drive falló, se sigue usando la anterior)
  if (carpetas.some((c) => c.archivos > 0)) await db.insert(settings).values({ key: KEY, value: result }).onConflictDoUpdate({ target: settings.key, set: { value: result } });
  return result;
}

/** Las fotos encontradas en Drive (la última búsqueda), o null si nunca se buscó. */
export async function getDiscoveredMatches(): Promise<Record<string, DriveMatch[]> | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, KEY) });
  return (row?.value as Discovery | undefined)?.matches ?? null;
}
