import type { Metadata } from "next";
import { Suspense } from "react";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { WholesaleAdmin } from "@/components/admin/wholesale-admin";
import { AdminLoading, AdminTitle } from "@/components/admin/ui";
import { db } from "@/db";
import { orders, wholesaleCustomers } from "@/db/schema";
import { adminGate, getAdminProducts } from "@/lib/admin-data";
import { SITE_URL } from "@/lib/site";
import { getWholesaleSettings } from "@/lib/wholesale";

export const metadata: Metadata = { title: "Mayoristas" };

export default function WholesaleAdminPage() {
  return (
    <>
      <AdminTitle
        title="Mayoristas"
        subtitle="Se registran con sus datos en /mayoristas; cuando los aprobás les llega por WhatsApp su código personal y ven la misma tienda con precios por mayor. Los pedidos llegan marcados como MAYORISTA."
      />
      <Suspense fallback={<AdminLoading />}>
        <Content />
      </Suspense>
    </>
  );
}

async function getCustomers() {
  const orderStats = db
    .select({
      customerId: orders.wholesaleCustomerId,
      count: sql<number>`count(*)::int`.as("count"),
      lastOrderAt: sql<Date>`max(${orders.createdAt})`.as("last_order_at"),
    })
    .from(orders)
    .where(isNotNull(orders.wholesaleCustomerId))
    .groupBy(orders.wholesaleCustomerId)
    .as("order_stats");
  return db
    .select({ c: wholesaleCustomers, orders: orderStats.count, lastOrderAt: orderStats.lastOrderAt })
    .from(wholesaleCustomers)
    .leftJoin(orderStats, eq(orderStats.customerId, wholesaleCustomers.id))
    .orderBy(desc(wholesaleCustomers.createdAt));
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

async function Content() {
  await adminGate();
  const [config, rows, customers] = await Promise.all([getWholesaleSettings(), getAdminProducts(), getCustomers()]);
  return (
    <WholesaleAdmin
      config={config}
      link={`${SITE_URL}/mayoristas`}
      customers={customers.map(({ c, orders: count, lastOrderAt }) => ({
        id: c.id,
        name: c.name,
        business: c.business,
        taxId: c.taxId,
        phone: c.phone,
        email: c.email,
        city: c.city,
        instagram: c.instagram,
        salesChannel: c.salesChannel,
        comment: c.comment,
        status: c.status,
        createdAt: iso(c.createdAt)!,
        approvedAt: iso(c.approvedAt),
        lastLoginAt: iso(c.lastLoginAt),
        orders: count ?? 0,
        lastOrderAt: iso(lastOrderAt),
      }))}
      rows={rows.map((r) => ({ id: r.id, name: r.name, articleCode: r.articleCode, price: r.price, wholesalePrice: r.wholesalePrice, visible: r.visible, categoryName: r.categoryName }))}
    />
  );
}
