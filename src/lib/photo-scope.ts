import scope from "../../data/fotos-articulo.json";
import { baseTitle } from "@/lib/photo-classify";

// Qué fotos van en cada artículo cuando el nombre del archivo trae más de un código:
// - "… SET CON 39402": la foto es del artículo principal (el código antes de "SET CON"); en el otro
//   artículo muchas veces ni se ve la prenda, así que no se usa ahí.
// - Lo revisado a ojo en data/fotos-articulo.json: prenda sola de un conjunto ("solo"), fotos de conjunto
//   donde no se ve la prenda ("fuera") y la foto principal elegida a mano ("principal").

const SOLO = scope.solo as Record<string, string>;
const FUERA = new Map(Object.entries(scope.fuera as Record<string, string[]>).map(([a, list]) => [a, new Set(list.map((t) => t.toLowerCase()))]));
const PRINCIPAL = scope.principal as Record<string, string>;
const CODE = /(?<!\d)(3[5-9]\d{3}|4\d{4})(?!\d)/g;

/** ¿La foto (por su nombre de archivo) corresponde a este artículo? */
export function photoBelongs(title: string, article: string): boolean {
  const t = baseTitle(title);
  const only = SOLO[t];
  if (only) return only === article;
  if (FUERA.get(article)?.has(t.toLowerCase())) return false;
  const [primaryPart, setPart] = t.split(/_SET CON /i);
  if (setPart !== undefined) return [...primaryPart.matchAll(CODE)].some((m) => m[1] === article);
  return true;
}

/** Foto elegida a mano para ir primera en este artículo (nombre de archivo), si hay. */
export function chosenMainPhoto(article: string): string | undefined {
  return PRINCIPAL[article];
}

/** Para saber si cambiaron las reglas (y volver a ordenar). */
export const scopeRules = { principal: PRINCIPAL };
