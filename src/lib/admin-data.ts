import { and, asc, desc, eq, gte, lte, ne, sql, type SQL } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { categories, colors, orderItems, orders, productImages, products, settings, subscribers, variants, withdrawalRequests } from "@/db/schema";
import { isAdmin } from "@/lib/admin-guard";

// Lecturas del panel: siempre en vivo (sin caché) y solo con sesión de admin.

export async function adminGate(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

// ---------------------------------------------------------------- fechas (hora de Argentina)

const AR_OFFSET = "-03:00";

export function todayAR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

export function shiftDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00${AR_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type OrderFilters = { status: string | null; from: string | null; to: string | null };

export function parseOrderFilters(sp: Record<string, string | string[] | undefined>): OrderFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const status = one("estado");
  const from = one("desde");
  const to = one("hasta");
  const today = todayAR();
  return {
    status: status && ["nuevo", "confirmado", "entregado", "cancelado"].includes(status) ? status : null,
    from: from === "todo" ? null : from && YMD.test(from) ? from : monthStart(today),
    to: to && YMD.test(to) ? to : null,
  };
}

function orderWhere(f: OrderFilters): SQL | undefined {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(orders.status, f.status as "nuevo"));
  if (f.from) conds.push(gte(orders.createdAt, new Date(`${f.from}T00:00:00${AR_OFFSET}`)));
  if (f.to) conds.push(lte(orders.createdAt, new Date(`${f.to}T23:59:59.999${AR_OFFSET}`)));
  return conds.length ? and(...conds) : undefined;
}

// ---------------------------------------------------------------- pedidos

export async function getOrdersList(f: OrderFilters) {
  const where = orderWhere(f);
  const list = await db
    .select({
      id: orders.id,
      number: orders.number,
      createdAt: orders.createdAt,
      status: orders.status,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      deliveryMethod: orders.deliveryMethod,
      deliveryArea: orders.deliveryArea,
      paymentMethod: orders.paymentMethod,
      itemsCount: orders.itemsCount,
      subtotal: orders.subtotal,
      cashTotal: orders.cashTotal,
      trafficSource: orders.trafficSource,
      utmCampaign: orders.utmCampaign,
      channel: orders.channel,
      promoCode: orders.promoCode,
    })
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(500);

  // Totales y más pedidos: sin cancelados
  const active = and(...[where, ne(orders.status, "cancelado")].filter((c): c is SQL => Boolean(c)));
  const [totals] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      items: sql<number>`coalesce(sum(${orders.itemsCount}), 0)`.mapWith(Number),
      subtotal: sql<number>`coalesce(sum(${orders.subtotal}), 0)`.mapWith(Number),
      // Lo que se cobraría según el medio elegido (efectivo/transferencia con descuento)
      estimated: sql<number>`coalesce(sum(case when ${orders.paymentMethod} = 'tarjeta' then ${orders.subtotal} else ${orders.cashTotal} end), 0)`.mapWith(Number),
      delivered: sql<number>`coalesce(sum(case when ${orders.status} = 'entregado' then (case when ${orders.paymentMethod} = 'tarjeta' then ${orders.subtotal} else ${orders.cashTotal} end) else 0 end), 0)`.mapWith(Number),
    })
    .from(orders)
    .where(active);

  const top = await db
    .select({
      productId: orderItems.productId,
      name: orderItems.name,
      articleCode: orderItems.articleCode,
      quantity: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
      amount: sql<number>`sum(${orderItems.lineTotal})`.mapWith(Number),
      orders: sql<number>`count(distinct ${orderItems.orderId})`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(active)
    .groupBy(orderItems.productId, orderItems.name, orderItems.articleCode)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(10);

  const sources = await db
    .select({ source: sql<string>`coalesce(${orders.trafficSource}, 'directo')`, count: sql<number>`count(*)`.mapWith(Number) })
    .from(orders)
    .where(active)
    .groupBy(sql`coalesce(${orders.trafficSource}, 'directo')`)
    .orderBy(desc(sql`count(*)`));

  return { list, totals, top, sources };
}

export async function getOrderDetail(id: number) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!order) return null;
  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      name: orderItems.name,
      articleCode: orderItems.articleCode,
      size: orderItems.size,
      color: orderItems.color,
      sku: orderItems.sku,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      lineTotal: orderItems.lineTotal,
      slug: products.slug,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.id));
  return { order, items };
}

// ---------------------------------------------------------------- tablero

export async function getDashboard() {
  const today = todayAR();
  const from = new Date(`${monthStart(today)}T00:00:00${AR_OFFSET}`);
  const [month] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      estimated: sql<number>`coalesce(sum(case when ${orders.paymentMethod} = 'tarjeta' then ${orders.subtotal} else ${orders.cashTotal} end), 0)`.mapWith(Number),
    })
    .from(orders)
    .where(and(gte(orders.createdAt, from), ne(orders.status, "cancelado")));
  const [pending] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(orders).where(eq(orders.status, "nuevo"));
  const [catalog] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      visible: sql<number>`count(*) filter (where ${products.visible})`.mapWith(Number),
      noPhoto: sql<number>`count(*) filter (where not exists (select 1 from product_images pi where pi.product_id = ${products.id}))`.mapWith(Number),
      noPrice: sql<number>`count(*) filter (where ${products.price} <= 0)`.mapWith(Number),
    })
    .from(products);
  const [withdrawals] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(withdrawalRequests).where(eq(withdrawalRequests.status, "nuevo"));
  const recent = await db
    .select({ id: orders.id, number: orders.number, createdAt: orders.createdAt, status: orders.status, customerName: orders.customerName, subtotal: orders.subtotal, itemsCount: orders.itemsCount })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(8);
  return { month, pending: pending.count, catalog, withdrawals: withdrawals.count, recent };
}

// ---------------------------------------------------------------- productos

export type AdminProductRow = {
  id: number;
  slug: string;
  name: string;
  articleCode: string | null;
  categoryId: number | null;
  categoryName: string | null;
  price: number;
  wholesalePrice: number | null;
  visible: boolean;
  featured: boolean;
  publishedAt: string;
  isNew: boolean;
  imageUrl: string | null;
  imageCount: number;
  variantCount: number;
  stock: number | null; // null = sin control en al menos una variante activa
};

export async function getAdminProducts(newDays = 15): Promise<AdminProductRow[]> {
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      articleCode: products.articleCode,
      categoryId: products.categoryId,
      categoryName: categories.name,
      price: products.price,
      wholesalePrice: products.wholesalePrice,
      visible: products.visible,
      featured: products.featured,
      publishedAt: products.publishedAt,
      isNew: sql<boolean>`${products.publishedAt} > now() - make_interval(days => ${newDays}::int)`,
      imageUrl: sql<string | null>`(select pi.url from product_images pi where pi.product_id = ${products.id} order by pi.sort_order, pi.id limit 1)`,
      imageCount: sql<number>`(select count(*) from product_images pi where pi.product_id = ${products.id})`.mapWith(Number),
      variantCount: sql<number>`(select count(*) from variants v where v.product_id = ${products.id} and v.active)`.mapWith(Number),
      stock: sql<number | null>`(select case when bool_or(v.stock is null) then null else sum(v.stock) end from variants v where v.product_id = ${products.id} and v.active)`,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(categories.sortOrder), asc(products.name));
  return rows.map((r) => ({ ...r, publishedAt: r.publishedAt.toISOString(), stock: r.stock === null ? null : Number(r.stock) }));
}

export async function getAdminProduct(id: number) {
  const product = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!product) return null;
  const [vs, imgs, cats, allColors, sold] = await Promise.all([
    db
      .select({
        id: variants.id,
        size: variants.size,
        sizeOrder: variants.sizeOrder,
        sku: variants.sku,
        labelCode: variants.labelCode,
        stock: variants.stock,
        priceOverride: variants.priceOverride,
        active: variants.active,
        colorId: variants.colorId,
        color: colors.name,
      })
      .from(variants)
      .leftJoin(colors, eq(variants.colorId, colors.id))
      .where(eq(variants.productId, id))
      .orderBy(asc(colors.name), asc(variants.sizeOrder)),
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder), asc(productImages.id)),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select({ id: colors.id, name: colors.name }).from(colors).orderBy(asc(colors.name)),
    db
      .select({ quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.mapWith(Number) })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.productId, id), ne(orders.status, "cancelado"))),
  ]);
  return { product, variants: vs, images: imgs, categories: cats, colors: allColors, sold: sold[0]?.quantity ?? 0 };
}

export async function getCategoryOptions() {
  return db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getAdminCategories() {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      sortOrder: categories.sortOrder,
      visible: categories.visible,
      featured: categories.featured,
      imageUrl: categories.imageUrl,
      sizeGuide: categories.sizeGuide,
      productCount: sql<number>`(select count(*) from products p where p.category_id = ${categories.id} and p.visible)`.mapWith(Number),
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getWithdrawals() {
  return db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.createdAt)).limit(300);
}

// ---------------------------------------------------------------- clientas (pop-up de bienvenida)

export async function getSubscribers() {
  const rows = await db
    .select({
      id: subscribers.id,
      email: subscribers.email,
      phone: subscribers.phone,
      code: subscribers.code,
      discountPercent: subscribers.discountPercent,
      landingPath: subscribers.landingPath,
      utmSource: subscribers.utmSource,
      utmCampaign: subscribers.utmCampaign,
      usedAt: subscribers.usedAt,
      orderId: subscribers.orderId,
      orderNumber: orders.number,
      createdAt: subscribers.createdAt,
      recent: sql<boolean>`${subscribers.createdAt} > now() - interval '7 days'`,
    })
    .from(subscribers)
    .leftJoin(orders, eq(subscribers.orderId, orders.id))
    .orderBy(desc(subscribers.createdAt))
    .limit(5000);
  return rows.map((r) => ({ ...r, usedAt: r.usedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }));
}

// ---------------------------------------------------------------- revisión de fotos

export async function getPhotoDiagnostics() {
  const rows = await db
    .select({ key: settings.key, value: settings.value, updatedAt: settings.updatedAt })
    .from(settings)
    .where(sql`${settings.key} = 'diagnostico-fotos' or ${settings.key} like 'diagnostico-equipo:%'`)
    .orderBy(desc(settings.updatedAt))
    .limit(30);
  const last = (rows.find((r) => r.key === "diagnostico-fotos")?.value ?? null) as import("@/lib/photo-check").PhotoCheck | null;
  const reports = rows
    .filter((r) => r.key.startsWith("diagnostico-equipo:"))
    .slice(0, 15)
    .map((r) => {
      const v = r.value as { navegador?: string; pantalla?: string; pruebas?: { nombre: string; ok: boolean; detalle?: string }[] };
      return {
        key: r.key,
        fecha: r.updatedAt.toISOString(),
        navegador: v.navegador ?? "",
        pantalla: v.pantalla ?? "",
        fallas: (v.pruebas ?? []).filter((p) => !p.ok).map((p) => p.nombre),
      };
    });
  return { last, reports };
}
