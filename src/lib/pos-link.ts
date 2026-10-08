import { timingSafeEqual } from "node:crypto";
import { asc, eq, gt, inArray, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orderItems, orders, settings, variants } from "@/db/schema";
import { formatOrderNumber } from "@/lib/format";

// Conexión con el POS (inedita-pos), que es la fuente de verdad del stock:
// - El POS lee los pedidos web y pregunta en la caja si descontarlos de su stock (acá nunca se descuenta solo).
// - El POS manda su stock por SKU (mismo formato: 39603-NEGRO-M). Mientras no lo mande, o si lo apaga,
//   la web vende sin controlar stock (variants.stock = null).
// Las dos puntas comparten un secreto: POS_API_SECRET acá y TIENDA_WEB_SECRET en el POS. Si no está en
// las variables de Vercel, se toma de la base (settings "pos-conexion": { clave }).

const SECRET_KEY = "pos-conexion";
let cachedSecret: { value: string | null; at: number } | null = null;

async function expectedSecret(): Promise<string | null> {
  const fromEnv = process.env.POS_API_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (cachedSecret && Date.now() - cachedSecret.at < 60_000) return cachedSecret.value;
  const row = await db.query.settings.findFirst({ where: eq(settings.key, SECRET_KEY) });
  const value = (row?.value as { clave?: unknown } | undefined)?.clave;
  cachedSecret = { value: typeof value === "string" ? value : null, at: Date.now() };
  return cachedSecret.value;
}

export async function validPosToken(authorization: string | null): Promise<boolean> {
  const given = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!given) return false;
  const expected = await expectedSecret();
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Pedido web tal como lo recibe el POS (importes en centavos, como los guarda el POS). */
export type PosOrder = {
  numero: number;
  etiqueta: string;
  fecha: string;
  estado: "nuevo" | "confirmado" | "entregado" | "cancelado";
  canal: string;
  cliente: string;
  telefono: string;
  entrega: "retiro" | "envio";
  zona: string | null;
  pago: "efectivo" | "transferencia" | "tarjeta";
  comentario: string | null;
  subtotalCentavos: number;
  totalEfectivoCentavos: number;
  // varianteWeb: id de la variante en la web (para diagnóstico si el SKU no cruza)
  lineas: { sku: string | null; varianteWeb: number | null; articulo: string | null; nombre: string; talle: string | null; color: string | null; cantidad: number; precioUnitarioCentavos: number }[];
};

/** Pedidos con número mayor a `after` (los nuevos) más los pedidos `numbers` (para que el POS vea si se cancelaron). */
export async function ordersForPos(after: number, numbers: number[], limit = 100): Promise<PosOrder[]> {
  const where = numbers.length ? or(gt(orders.number, after), inArray(orders.number, numbers)) : gt(orders.number, after);
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      createdAt: orders.createdAt,
      status: orders.status,
      channel: orders.channel,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      deliveryMethod: orders.deliveryMethod,
      deliveryArea: orders.deliveryArea,
      paymentMethod: orders.paymentMethod,
      comment: orders.comment,
      subtotal: orders.subtotal,
      cashTotal: orders.cashTotal,
    })
    .from(orders)
    .where(where)
    .orderBy(asc(orders.number))
    .limit(limit + numbers.length);
  if (rows.length === 0) return [];
  const items = await db
    .select({ orderId: orderItems.orderId, sku: orderItems.sku, variantId: orderItems.variantId, articleCode: orderItems.articleCode, name: orderItems.name, size: orderItems.size, color: orderItems.color, quantity: orderItems.quantity, unitPrice: orderItems.unitPrice })
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)))
    .orderBy(asc(orderItems.id));
  return rows.map((r) => ({
    numero: r.number,
    etiqueta: formatOrderNumber(r.number),
    fecha: r.createdAt.toISOString(),
    estado: r.status,
    canal: r.channel,
    cliente: r.customerName,
    telefono: r.customerPhone,
    entrega: r.deliveryMethod,
    zona: r.deliveryArea,
    pago: r.paymentMethod,
    comentario: r.comment,
    subtotalCentavos: r.subtotal * 100,
    totalEfectivoCentavos: r.cashTotal * 100,
    lineas: items
      .filter((i) => i.orderId === r.id)
      .map((i) => ({ sku: i.sku, varianteWeb: i.variantId, articulo: i.articleCode, nombre: i.name, talle: i.size, color: i.color, cantidad: i.quantity, precioUnitarioCentavos: i.unitPrice * 100 })),
  }));
}

export const posStockSchema = z.object({
  // Disponible en el POS por SKU (stock menos lo reservado por señas)
  items: z.array(z.object({ sku: z.string().trim().min(1).max(80), stock: z.number().int() })).max(10_000).default([]),
  // El POS apagó la publicación del stock: la web vuelve a vender sin controlar stock
  desactivar: z.boolean().optional(),
});

export async function applyPosStock(input: z.infer<typeof posStockSchema>) {
  if (input.desactivar) {
    const cleared = await db.update(variants).set({ stock: null }).where(isNotNull(variants.stock)).returning({ id: variants.id });
    return { recibidos: 0, actualizados: cleared.length, sinVariante: [] as string[], cantidadSinVariante: 0 };
  }
  // Si el mismo SKU viene dos veces, vale el último; el stock negativo del POS en la web es 0 (agotado)
  const wanted = new Map(input.items.map((i) => [i.sku.toUpperCase(), Math.max(0, i.stock)]));
  const skus = [...wanted.keys()];
  const found: { id: number; sku: string; stock: number | null }[] = [];
  for (let k = 0; k < skus.length; k += 1000) {
    found.push(
      ...(await db
        .select({ id: variants.id, sku: variants.sku, stock: variants.stock })
        .from(variants)
        .where(inArray(sql`upper(${variants.sku})`, skus.slice(k, k + 1000)))),
    );
  }
  const changes = found.filter((v) => v.stock !== wanted.get(v.sku.toUpperCase())).map((v) => [v.id, wanted.get(v.sku.toUpperCase())!] as const);
  for (let k = 0; k < changes.length; k += 500) {
    const part = changes.slice(k, k + 500);
    await db.execute(
      sql`update variants v set stock = x.stock, updated_at = now() from (values ${sql.join(
        part.map(([id, stock]) => sql`(${id}::int, ${stock}::int)`),
        sql`, `,
      )}) as x(id, stock) where v.id = x.id`,
    );
  }
  const known = new Set(found.map((v) => v.sku.toUpperCase()));
  const missing = skus.filter((s) => !known.has(s));
  return { recibidos: skus.length, actualizados: changes.length, sinVariante: missing.slice(0, 100), cantidadSinVariante: missing.length };
}
