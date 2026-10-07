import type { Metadata } from "next";
import { CategoryChips } from "@/components/category-chips";
import { PageTitle } from "@/components/page-title";
import { ProductListing } from "@/components/product/product-listing";
import { getCatalog, getCategories } from "@/lib/catalog";
import { toEntry } from "@/lib/catalog-entry";

export const metadata: Metadata = {
  title: "Toda la colección",
  description: "Toda la colección de INEDITA: vestidos, jeans, remeras, blazers y más. Pedí por WhatsApp con 10% OFF en efectivo o transferencia.",
  alternates: { canonical: "/productos" },
};

export default async function ProductsPage() {
  const [catalog, categories] = await Promise.all([getCatalog(), getCategories()]);
  const entries = catalog.map(toEntry);
  return (
    <>
      <PageTitle title="Toda la colección" count={entries.length} />
      <CategoryChips categories={categories} active={null} />
      <ProductListing products={entries} />
    </>
  );
}
