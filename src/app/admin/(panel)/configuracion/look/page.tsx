import type { Metadata } from "next";
import { Suspense } from "react";
import { LookEditor } from "@/components/admin/look-editor";
import { SettingsNav } from "@/components/admin/settings-nav";
import { AdminLoading, AdminTitle } from "@/components/admin/ui";
import { adminGate, getAdminProducts } from "@/lib/admin-data";
import { getLookSettings } from "@/lib/catalog";

export const metadata: Metadata = { title: "Comprá el look" };

export default function LookPage() {
  return (
    <>
      <AdminTitle title="Configuración" subtitle="Bloque “Comprá el look” de la home" />
      <SettingsNav active="/admin/configuracion/look" />
      <Suspense fallback={<AdminLoading />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await adminGate();
  const [look, products] = await Promise.all([getLookSettings(), getAdminProducts()]);
  return <LookEditor initial={look} products={products.map((p) => ({ id: p.id, name: p.name, articleCode: p.articleCode, imageUrl: p.imageUrl, visible: p.visible }))} />;
}
