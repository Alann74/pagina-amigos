import { asc, eq } from "drizzle-orm";
import Papa from "papaparse";
import { db } from "@/db";
import { categories, colors, products, variants } from "@/db/schema";
import { isAdmin } from "@/lib/admin-guard";
import { todayAR } from "@/lib/admin-data";

// Exporta una fila por variante (artículo + color + talle). Separador ";" para que Excel en español lo abra bien.
export async function GET() {
  if (!(await isAdmin())) return new Response("No autorizado", { status: 401 });
  const rows = await db
    .select({
      articulo: products.articleCode,
      sku: variants.sku,
      nombre: products.name,
      categoria: categories.name,
      color: colors.name,
      talle: variants.size,
      precio: products.price,
      precioVariante: variants.priceOverride,
      stock: variants.stock,
      visible: products.visible,
      activa: variants.active,
      etiqueta: variants.labelCode,
    })
    .from(variants)
    .innerJoin(products, eq(variants.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(colors, eq(variants.colorId, colors.id))
    .orderBy(asc(products.articleCode), asc(colors.name), asc(variants.sizeOrder));

  const csv = Papa.unparse(
    rows.map((r) => ({
      articulo: r.articulo ?? "",
      sku: r.sku,
      nombre: r.nombre,
      categoria: r.categoria ?? "",
      color: r.color ?? "",
      talle: r.talle,
      precio: r.precio,
      stock: r.stock === null ? "-" : r.stock,
      visible: r.visible ? "si" : "no",
      etiqueta: r.etiqueta ?? "",
      variante_activa: r.activa ? "si" : "no",
      precio_variante: r.precioVariante ?? "",
    })),
    { delimiter: ";" },
  );
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inedita-productos-${todayAR()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
