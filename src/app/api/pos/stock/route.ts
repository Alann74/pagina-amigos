import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/catalog";
import { applyPosStock, posStockSchema, validPosToken } from "@/lib/pos-link";

export const maxDuration = 60;

// El POS manda su stock por SKU: { items: [{ sku, stock }] }, o { desactivar: true } para volver a vender sin controlar stock.
export async function POST(request: Request) {
  if (!validPosToken(request.headers.get("authorization"))) return Response.json({ error: "No autorizado" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const parsed = posStockSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  try {
    const result = await applyPosStock(parsed.data);
    if (result.actualizados) revalidateTag(TAGS.catalog, { expire: 0 });
    return Response.json(result);
  } catch (error) {
    console.error("[pos/stock]", error);
    return Response.json({ error: "No se pudo actualizar el stock" }, { status: 500 });
  }
}
