import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoriesEditor } from "@/components/admin/categories-editor";
import { SettingsNav } from "@/components/admin/settings-nav";
import { AdminLoading, AdminTitle } from "@/components/admin/ui";
import { adminGate, getAdminCategories } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Categorías" };

export default function CategoriesPage() {
  return (
    <>
      <AdminTitle title="Configuración" subtitle="Orden del menú, categorías destacadas en la home y guía de talles" />
      <SettingsNav active="/admin/configuracion/categorias" />
      <Suspense fallback={<AdminLoading />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await adminGate();
  return <CategoriesEditor categories={await getAdminCategories()} />;
}
