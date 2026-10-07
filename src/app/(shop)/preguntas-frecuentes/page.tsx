import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { getPages } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const pages = await getPages();
  return { title: pages.faq.title, description: "Preguntas frecuentes sobre cómo comprar en INEDITA por WhatsApp, pagos, envíos y cambios.", alternates: { canonical: "/preguntas-frecuentes" } };
}

export default async function Page() {
  const pages = await getPages();
  return <ContentPage title={pages.faq.title} body={pages.faq.body} />;
}
