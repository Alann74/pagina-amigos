import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  imageUrl: text("image_url"),
  // Clave de la guía de talles que se muestra en la ficha: "letras", "jeans", "unico"
  sizeGuide: text("size_guide").notNull().default("letras"),
  posCategoryId: integer("pos_category_id"),
  ...timestamps,
});

export const colors = pgTable("colors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  // Sufijo de color en la etiqueta física (ej. "BC" en 39603%BC...). Lo completa el POS.
  brandCode: text("brand_code"),
  posColorId: integer("pos_color_id"),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    // Código de artículo de 5 dígitos (ej. 39603). Clave de integración con el POS y con las fotos.
    articleCode: text("article_code").unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    // Precios en pesos enteros (sin decimales)
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    // Precio por mayor (solo lo ven los mayoristas que entran con el código en /mayoristas)
    wholesalePrice: integer("wholesale_price"),
    visible: boolean("visible").notNull().default(true),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    // Fecha usada para la etiqueta NUEVO (editable: al reingresar mercadería se puede renovar)
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    posProductId: integer("pos_product_id").unique(),
    ...timestamps,
  },
  (t) => [index("products_category_idx").on(t.categoryId), index("products_visible_idx").on(t.visible)],
);

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    blobPath: text("blob_path"),
    alt: text("alt").notNull().default(""),
    colorId: integer("color_id").references(() => colors.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    driveFileId: text("drive_file_id"),
    sourceName: text("source_name"),
    ...timestamps,
  },
  (t) => [
    index("product_images_product_idx").on(t.productId),
    uniqueIndex("product_images_product_drive_uidx").on(t.productId, t.driveFileId),
  ],
);

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colorId: integer("color_id").references(() => colors.id, { onDelete: "set null" }),
    size: text("size").notNull(),
    sizeOrder: integer("size_order").notNull().default(0),
    // SKU con el mismo formato que el POS: 39603-NEGRO-M
    sku: text("sku").notNull().unique(),
    // Código de etiqueta física, ej. 39603%DMS (artículo + sufijo de color y talle)
    labelCode: text("label_code").unique(),
    // null = stock no controlado (se vende como disponible)
    stock: integer("stock"),
    priceOverride: integer("price_override"),
    active: boolean("active").notNull().default(true),
    posVariantId: integer("pos_variant_id").unique(),
    ...timestamps,
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

export const orderStatus = pgEnum("order_status", ["nuevo", "confirmado", "entregado", "cancelado"]);
export const deliveryMethod = pgEnum("delivery_method", ["retiro", "envio"]);
export const paymentMethod = pgEnum("payment_method", ["efectivo", "transferencia", "tarjeta"]);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    // Número correlativo que se muestra como #INE-0001
    number: serial("number").notNull().unique(),
    // Token aleatorio para la página de confirmación (no se expone el número correlativo)
    publicToken: text("public_token").notNull().unique(),
    status: orderStatus("status").notNull().default("nuevo"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    deliveryMethod: deliveryMethod("delivery_method").notNull(),
    deliveryArea: text("delivery_area"),
    paymentMethod: paymentMethod("payment_method").notNull(),
    comment: text("comment"),
    itemsCount: integer("items_count").notNull(),
    subtotal: integer("subtotal").notNull(),
    cashTotal: integer("cash_total").notNull(),
    discountPercent: integer("discount_percent").notNull().default(0),
    whatsappMessage: text("whatsapp_message").notNull(),
    // "minorista" (tienda) o "mayorista" (entró con el código de /mayoristas)
    channel: text("channel").notNull().default("minorista"),
    // Código de bienvenida del pop-up (20% OFF en la primera compra) si se aplicó
    promoCode: text("promo_code"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    trafficSource: text("traffic_source"),
    referrer: text("referrer"),
    landingPath: text("landing_path"),
    userAgent: text("user_agent"),
    adminNote: text("admin_note"),
    ...timestamps,
  },
  (t) => [index("orders_created_idx").on(t.createdAt), index("orders_status_idx").on(t.status)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
    articleCode: text("article_code"),
    name: text("name").notNull(),
    size: text("size"),
    color: text("color"),
    sku: text("sku"),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_product_idx").on(t.productId)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
});

export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: serial("id").primaryKey(),
  number: serial("number").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  orderReference: text("order_reference"),
  detail: text("detail"),
  status: text("status").notNull().default("nuevo"),
  ...timestamps,
});

// Suscriptas del pop-up de bienvenida: dejan mail y WhatsApp y reciben un código de descuento para la primera compra
export const subscribers = pgTable(
  "subscribers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    phone: text("phone").notNull(),
    // Últimos 8 dígitos del teléfono: así se reconoce a la clienta aunque escriba el número distinto (con 0, 15, +54…)
    phoneKey: text("phone_key").notNull(),
    code: text("code").notNull().unique(),
    discountPercent: integer("discount_percent").notNull(),
    landingPath: text("landing_path"),
    utmSource: text("utm_source"),
    utmCampaign: text("utm_campaign"),
    usedAt: timestamp("used_at", { withTimezone: true }),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subscribers_phone_idx").on(t.phoneKey), index("subscribers_created_idx").on(t.createdAt)],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

// Fotos guardadas en la base (reemplaza a Vercel Blob, que en el plan gratis se suspende al pasar el límite).
// Se guarda una sola versión grande (WebP); los demás tamaños y el JPG se generan al pedirlos y quedan en la caché.
export const media = pgTable("media", {
  key: text("key").primaryKey(), // ej. "p/39603-1a2b3c4d5e6f" o "c/hero-1a2b3c4d5e6f"
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bytes: integer("bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Category = typeof categories.$inferSelect;
export type Color = typeof colors.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
