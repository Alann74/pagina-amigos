import type { Metadata } from "next";
import { Suspense } from "react";
import { NewProductsImport } from "@/components/admin/new-products-import";
import { AdminLoading, AdminTitle } from "@/components/admin/ui";
import { adminGate } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Importar productos nuevos" };

export default function ImportProductsPage() {
  return (
    <>
      <AdminTitle
        title="Importar productos nuevos"
        subtitle="Subí la lista con artículo, nombre y precio minorista. Los productos se crean ocultos y se publican solos cuando tienen foto."
      />
      <Suspense fallback={<AdminLoading />}>
        <Gate />
      </Suspense>
    </>
  );
}

async function Gate() {
  await adminGate();
  return <NewProductsImport />;
}
