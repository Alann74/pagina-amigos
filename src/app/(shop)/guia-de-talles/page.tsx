import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { getPages } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const pages = await getPages();
  return { title: pages.talles.title, description: "Guía de talles de INEDITA: prendas S a XL y jeans del 22 al 36.", alternates: { canonical: "/guia-de-talles" } };
}

export default async function Page() {
  const pages = await getPages();
  return <ContentPage title={pages.talles.title} body={pages.talles.body} />;
}
