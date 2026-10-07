import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewProductForm } from "@/components/admin/new-product-form";
import { AdminLoading, AdminTitle } from "@/components/admin/ui";
import { adminGate, getCategoryOptions } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function NewProductPage() {
  return (
    <>
      <Link href="/admin/productos" className="nav-link text-mute hover:text-ink">
        ← Productos
      </Link>
      <div className="mt-4">
        <AdminTitle title="Nuevo producto" />
      </div>
      <Suspense fallback={<AdminLoading />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  await adminGate();
  return <NewProductForm categories={await getCategoryOptions()} />;
}
