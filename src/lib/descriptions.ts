import descripciones from "../../data/descripciones.json";

// Descripciones de los artículos (data/descripciones.json): de la tienda oficial (ineditargentina.com)
// y del catálogo de precios por mayor 2027. Texto, composición real de la tela y medidas si las hay.

export type Descripcion = { texto: string; composicion: string; medidas?: string; fuente: string; url?: string };

export const DESCRIPCIONES = descripciones as Record<string, Descripcion>;

/** Descripción en el formato de la ficha (markdown simple). */
export function descriptionMarkdown(d: Descripcion): string {
  const partes = [d.texto];
  if (d.composicion) partes.push(`**Composición:** ${d.composicion}`);
  if (d.medidas) {
    const [titulo, ...filas] = d.medidas.split("\n");
    partes.push(`**${titulo}**`, filas.map((f) => `- ${f}`).join("\n"));
  }
  return partes.join("\n\n");
}
