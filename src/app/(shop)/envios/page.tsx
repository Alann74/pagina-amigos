import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { getPages } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const pages = await getPages();
  return { title: pages.envios.title, description: "Retiro en Mitre 830, Rosario, y envíos a coordinar por WhatsApp.", alternates: { canonical: "/envios" } };
}

export default async function Page() {
  const pages = await getPages();
  return <ContentPage title={pages.envios.title} body={pages.envios.body} />;
}
