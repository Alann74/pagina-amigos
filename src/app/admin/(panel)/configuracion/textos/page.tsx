import type { Metadata } from "next";
import { Suspense } from "react";
import { PagesEditor } from "@/components/admin/pages-editor";
import { SettingsNav } from "@/components/admin/settings-nav";
import { AdminLoading, AdminTitle } from "@/components/admin/ui";
import { adminGate } from "@/lib/admin-data";
import { getPages } from "@/lib/catalog";

export const metadata: Metadata = { title: "Textos" };

export default function TextsPage() {
  return (
    <>
      <AdminTitle title="Configuración" subtitle="Preguntas frecuentes, cambios, envíos, guía de talles y contacto" />
      <SettingsNav active="/admin/configuracion/textos" />
      <Suspense fallback={<AdminLoading />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await adminGate();
  return <PagesEditor initial={await getPages()} />;
}
