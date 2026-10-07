import type { Metadata } from "next";
import { Suspense } from "react";
import { WholesaleAdmin } from "@/components/admin/wholesale-admin";
import { AdminLoading, AdminTitle } from "@/components/admin/ui";
import { adminGate, getAdminProducts } from "@/lib/admin-data";
import { SITE_URL } from "@/lib/site";
import { getWholesaleSettings } from "@/lib/wholesale";

export const metadata: Metadata = { title: "Mayoristas" };

export default function WholesaleAdminPage() {
  return (
    <>
      <AdminTitle title="Mayoristas" subtitle="La misma tienda con precios por mayor, para quien entra con el código. Los pedidos llegan marcados como MAYORISTA." />
      <Suspense fallback={<AdminLoading />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await adminGate();
  const [config, rows] = await Promise.all([getWholesaleSettings(), getAdminProducts()]);
  return (
    <WholesaleAdmin
      config={config}
      link={`${SITE_URL}/mayoristas`}
      rows={rows.map((r) => ({ id: r.id, name: r.name, articleCode: r.articleCode, price: r.price, wholesalePrice: r.wholesalePrice, visible: r.visible, categoryName: r.categoryName }))}
    />
  );
}
