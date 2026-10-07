import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { colors, orderItems, orders, products, variants } from "@/db/schema";
import { cashPrice, formatOrderNumber } from "@/lib/format";
import type { SiteSettings } from "@/lib/site-config";
import { buildOrderMessage, whatsappUrl } from "@/lib/whatsapp";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const orderInputSchema = z
  .object({
    items: z
      .array(z.object({ variantId: z.number().int().positive(), quantity: z.number().int().min(1).max(10) }))
      .min(1, "El carrito está vacío")
      .max(60),
    customerName: z.string().trim().min(2, "Ingresá tu nombre").max(80),
    customerPhone: z
      .string()
      .trim()
      .max(30)
      .refine((v) => v.replace(/\D/g, "").length >= 8, "Ingresá un teléfono válido"),
    deliveryMethod: z.enum(["retiro", "envio"]),
    deliveryArea: optionalText(120),
    paymentMethod: z.enum(["efectivo", "transferencia", "tarjeta"]),
    comment: optionalText(500),
    attribution: z
      .object({
        utmSource: optionalText(120),
        utmMedium: optionalText(120),
        utmCampaign: optionalText(160),
        utmContent: optionalText(160),
        utmTerm: optionalText(160),
        trafficSource: optionalText(80),
        referrer: optionalText(500),
        landingPath: optionalText(500),
      })
      .optional()
      .nullable(),
    website: z.string().max(0).optional(), // honeypot: los bots lo completan
  })
  .refine((v) => v.deliveryMethod !== "envio" || (v.deliveryArea && v.deliveryArea.length >= 2), {
    message: "Indicá tu barrio o localidad para el envío",
    path: ["deliveryArea"],
  });

export type OrderInput = z.infer<typeof orderInputSchema>;

export class OrderError extends Error {
  constructor(
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function createOrder(input: OrderInput, settings: SiteSettings, userAgent: string | null) {
  // Agrupamos por variante por si el cliente mandó la misma dos veces
  const qtyByVariant = new Map<number, number>();
  for (const item of input.items) qtyByVariant.set(item.variantId, Math.min(10, (qtyByVariant.get(item.variantId) ?? 0) + item.quantity));
  const ids = [...qtyByVariant.keys()];

  const rows = await db
    .select({
      variantId: variants.id,
      productId: products.id,
      sku: variants.sku,
      size: variants.size,
      stock: variants.stock,
      active: variants.active,
      priceOverride: variants.priceOverride,
      price: products.price,
      name: products.name,
      articleCode: products.articleCode,
      visible: products.visible,
      color: colors.name,
    })
    .from(variants)
    .innerJoin(products, eq(variants.productId, products.id))
    .leftJoin(colors, eq(variants.colorId, colors.id))
    .where(inArray(variants.id, ids));

  const byId = new Map(rows.map((r) => [r.variantId, r]));
  const unavailable: number[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row || !row.active || !row.visible || (row.stock !== null && row.stock < (qtyByVariant.get(id) ?? 1))) unavailable.push(id);
  }
  if (unavailable.length) {
    throw new OrderError("Algunos productos ya no están disponibles. Revisá tu bolsa.", 409, { unavailable });
  }

  // Precios siempre desde la base (nunca los que manda el navegador)
  const lines = ids.map((id) => {
    const row = byId.get(id)!;
    const quantity = qtyByVariant.get(id)!;
    const unitPrice = row.priceOverride ?? row.price;
    return { row, quantity, unitPrice, lineTotal: unitPrice * quantity };
  });
  const subtotal = lines.reduce((acc, l) => acc + l.lineTotal, 0);
  const discountPercent = settings.promo.cashDiscountPercent;
  const cashTotal = cashPrice(subtotal, discountPercent);
  const itemsCount = lines.reduce((acc, l) => acc + l.quantity, 0);
  const publicToken = randomBytes(18).toString("base64url");
  const a = input.attribution ?? null;

  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        publicToken,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveryMethod: input.deliveryMethod,
        deliveryArea: input.deliveryMethod === "envio" ? input.deliveryArea : null,
        paymentMethod: input.paymentMethod,
        comment: input.comment,
        itemsCount,
        subtotal,
        cashTotal,
        discountPercent,
        whatsappMessage: "",
        utmSource: a?.utmSource ?? null,
        utmMedium: a?.utmMedium ?? null,
        utmCampaign: a?.utmCampaign ?? null,
        utmContent: a?.utmContent ?? null,
        utmTerm: a?.utmTerm ?? null,
        trafficSource: a?.trafficSource ?? "directo",
        referrer: a?.referrer ?? null,
        landingPath: a?.landingPath ?? null,
        userAgent: userAgent?.slice(0, 400) ?? null,
      })
      .returning({ id: orders.id, number: orders.number });

    const label = formatOrderNumber(order.number);
    const message = buildOrderMessage({
      orderLabel: label,
      items: lines.map((l) => ({
        name: l.row.name,
        articleCode: l.row.articleCode,
        size: l.row.size,
        color: l.row.color,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      subtotal,
      cashTotal,
      discountPercent,
      installments: settings.promo.installments,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      delivery: { method: input.deliveryMethod, area: input.deliveryArea, storeAddressShort: settings.address.split(",")[0] ?? settings.address },
      payment: input.paymentMethod,
      comment: input.comment,
    });

    await tx.update(orders).set({ whatsappMessage: message }).where(eq(orders.id, order.id));
    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.row.productId,
        variantId: l.row.variantId,
        articleCode: l.row.articleCode,
        name: l.row.name,
        size: l.row.size,
        color: l.row.color,
        sku: l.row.sku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
    );
    return { number: order.number, label, message };
  });

  return {
    ...result,
    token: publicToken,
    subtotal,
    cashTotal,
    whatsappUrl: whatsappUrl(settings.whatsappNumber, result.message),
    items: lines.map((l) => ({ id: l.row.articleCode ?? String(l.row.productId), name: l.row.name, price: l.unitPrice, quantity: l.quantity })),
  };
}
