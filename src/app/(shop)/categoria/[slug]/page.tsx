import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageTitle } from "@/components/page-title";
import { ProductListing } from "@/components/product/product-listing";
import { GridSkeleton } from "@/components/skeletons";
import { getCatalog, getCategories, getCategoryBySlug } from "@/lib/catalog";
import { toEntry } from "@/lib/catalog-entry";

export async function generateStaticParams() {
  const categories = await getCategories();
  const slugs = categories.filter((c) => c.productCount > 0).map((c) => ({ slug: c.slug }));
  return slugs.length ? slugs : [{ slug: "__placeholder__" }];
}

export async function generateMetadata({ params }: PageProps<"/categoria/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Categoría no encontrada" };
  return {
    title: category.name,
    description: `${category.name} de mujer en INEDITA. Local en Mitre 830, Rosario. Elegí tu talle y pedí por WhatsApp con 10% OFF en efectivo o transferencia.`,
    alternates: { canonical: `/categoria/${category.slug}` },
  };
}

async function CategoryContent({ params }: { params: PageProps<"/categoria/[slug]">["params"] }) {
  const { slug } = await params;
  const [category, catalog] = await Promise.all([getCategoryBySlug(slug), getCatalog()]);
  if (!category) notFound();
  const entries = catalog.filter((p) => p.categorySlug === category.slug).map(toEntry);
  return (
    <>
      <PageTitle title={category.name} count={entries.length} />
      <ProductListing products={entries} emptyText="Pronto vas a encontrar productos en esta categoría." />
    </>
  );
}

export default function CategoryPage({ params }: PageProps<"/categoria/[slug]">) {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <CategoryContent params={params} />
    </Suspense>
  );
}
