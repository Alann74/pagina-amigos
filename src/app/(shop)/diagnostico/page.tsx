import type { Metadata } from "next";
import { PhotoDiagnostic } from "@/components/photo-diagnostic";
import { getCatalog, getSettings } from "@/lib/catalog";
import { toEntry } from "@/lib/catalog-entry";

export const metadata: Metadata = {
  title: "Prueba de fotos",
  robots: { index: false, follow: false },
};

// Página de prueba: se abre en el celular o la compu donde no se ven las fotos. Prueba cómo carga las
// fotos ese equipo y manda el resultado (sin datos personales) para revisarlo.
export default async function DiagnosticPage() {
  const [catalog, settings] = await Promise.all([getCatalog(), getSettings()]);
  const sample = catalog.slice(0, 6).map(toEntry);
  return <PhotoDiagnostic sample={sample} heroUrl={settings.hero.imageUrl} />;
}
