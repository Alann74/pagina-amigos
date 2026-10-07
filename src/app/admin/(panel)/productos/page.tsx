import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductsTable } from "@/components/admin/products-table";
import { AdminLoading, AdminTitle } from "@/components/admin/ui";
import { adminGate, getAdminProducts, getCategoryOptions } from "@/lib/admin-data";
import { getSettings } from "@/lib/catalog";

export const metadata: Metadata = { title: "Productos" };

export default function ProductsPage() {
  return (
    <>
      <AdminTitle title="Productos" subtitle="Tocá un producto para editar datos, fotos y stock">
        <Link href="/admin/productos/importar" className="btn btn-secondary">
          Importar lista
        </Link>
        <Link href="/admin/productos/nuevo" className="btn btn-primary">
          Nuevo producto
        </Link>
      </AdminTitle>
      <Suspense fallback={<AdminLoading />}>
        <Products />
      </Suspense>
    </>
  );
}

async function Products() {
  await adminGate();
  const settings = await getSettings();
  const [rows, categories] = await Promise.all([getAdminProducts(settings.newProductDays), getCategoryOptions()]);
  return <ProductsTable rows={rows} categories={categories} />;
}
