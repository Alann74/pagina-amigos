import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { getPages } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const pages = await getPages();
  return { title: pages.cambios.title, description: "Cambios dentro de los 30 días y derecho de arrepentimiento en INEDITA.", alternates: { canonical: "/cambios-y-devoluciones" } };
}

export default async function Page() {
  const pages = await getPages();
  return <ContentPage title={pages.cambios.title} body={pages.cambios.body} />;
}
