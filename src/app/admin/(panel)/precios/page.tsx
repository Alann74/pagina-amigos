import type { Metadata } from "next";
import { Suspense } from "react";
import { PriceTools } from "@/components/admin/price-tools";
import { AdminLoading, AdminTitle } from "@/components/admin/ui";
import { adminGate, getAdminProducts, getCategoryOptions } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Precios" };

export default function PricesPage() {
  return (
    <>
      <AdminTitle title="Precios" subtitle="Aumentos por porcentaje con vista previa y edición rápida. Los cambios se ven en la tienda al instante." />
      <Suspense fallback={<AdminLoading />}>
        <Prices />
      </Suspense>
    </>
  );
}

async function Prices() {
  await adminGate();
  const [rows, categories] = await Promise.all([getAdminProducts(), getCategoryOptions()]);
  return (
    <PriceTools
      rows={rows.map((r) => ({ id: r.id, name: r.name, articleCode: r.articleCode, categoryId: r.categoryId, categoryName: r.categoryName, price: r.price, visible: r.visible }))}
      categories={categories}
    />
  );
}
