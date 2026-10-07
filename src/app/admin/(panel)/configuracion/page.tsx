import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsForm } from "@/components/admin/settings-form";
import { SettingsNav } from "@/components/admin/settings-nav";
import { AdminLoading, AdminTitle } from "@/components/admin/ui";
import { adminGate } from "@/lib/admin-data";
import { getSettings } from "@/lib/catalog";

export const metadata: Metadata = { title: "Configuración" };

export default function SettingsPage() {
  return (
    <>
      <AdminTitle title="Configuración" subtitle="WhatsApp, anuncio, portada, promo y horarios" />
      <SettingsNav active="/admin/configuracion" />
      <Suspense fallback={<AdminLoading />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await adminGate();
  return <SettingsForm initial={await getSettings()} />;
}
